#!/usr/bin/env node

/**
 * freee MCP Server テストツール (Claude Code 向け最適化版)
 * 使いやすさとパフォーマンスを重視したシンプルなテストスクリプト
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

class FreeMcpTester {
  constructor() {
    this.mcpProcess = null;
    this.requestId = 1;
    this.isInitialized = false;
    this.responses = [];
    this.rl = null;
    this.isShuttingDown = false;
  }

  getNextRequestId() {
    return this.requestId++;
  }

  sendMcpMessage(message) {
    if (!this.mcpProcess) {
      console.error('❌ MCPプロセスが開始されていません');
      return;
    }
    const jsonMessage = JSON.stringify(message);
    this.mcpProcess.stdin.write(jsonMessage + '\n');
  }

  async startMcpServer() {
    if (this.mcpProcess) {
      console.log('✅ MCPサーバーは既に起動済みです');
      return;
    }

    console.log('🚀 freee MCP Server を起動しています...');
    
    this.mcpProcess = spawn('pnpm', ['tsx', 'src/index.ts'], {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: { ...process.env, FREEE_CALLBACK_PORT: '8085' }
    });

    // レスポンス処理 (改良版)
    let accumulatedData = '';
    this.mcpProcess.stdout.on('data', (data) => {
      accumulatedData += data.toString();
      const lines = accumulatedData.split('\n');
      accumulatedData = lines.pop() || '';
      
      lines.forEach((line) => {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            this.responses.push(response);
          } catch (error) {
            // 大きなJSONの場合は再度蓄積
            if (line.includes('"tools":[') && !line.includes(']}}')) {
              accumulatedData = line + accumulatedData;
            }
          }
        }
      });
    });

    // エラーログ処理
    this.mcpProcess.stderr.on('data', (data) => {
      const log = data.toString().trim();
      if (!log.includes('Port 8080 is already in use')) {
        console.log(`📋 ${log}`);
      }
    });

    // プロセス終了処理
    this.mcpProcess.on('exit', (code) => {
      if (!this.isShuttingDown) {
        console.log(`\n🏁 MCPサーバーが終了しました (コード: ${code})`);
      }
    });

    // 起動待機
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async initializeMcp() {
    if (this.isInitialized) {
      return;
    }

    console.log('🔧 MCP初期化中...');

    // 初期化
    this.sendMcpMessage({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: { tools: {} },
        clientInfo: { name: 'freee-mcp-simple-test', version: '1.0.0' }
      }
    });

    await new Promise(resolve => setTimeout(resolve, 500));

    // ツール一覧取得
    this.sendMcpMessage({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/list',
      params: {}
    });

    await new Promise(resolve => setTimeout(resolve, 1000));
    this.isInitialized = true;
    console.log('✅ MCP初期化完了\n');
  }

  parseToolInput(input) {
    const trimmed = input.trim();
    
    // JSON形式の場合
    const jsonMatch = trimmed.match(/^(\S+)\s+(\{.+\})$/);
    if (jsonMatch) {
      try {
        const toolName = jsonMatch[1];
        const args = JSON.parse(jsonMatch[2]);
        return { toolName, arguments: args };
      } catch (e) {
        console.log('❌ JSON解析エラー:', e.message);
        return null;
      }
    }
    
    // key=value形式の場合
    const parts = trimmed.split(/\s+/);
    const toolName = parts[0];
    const args = {};
    
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const eqIndex = part.indexOf('=');
      if (eqIndex > 0) {
        const key = part.substring(0, eqIndex);
        let value = part.substring(eqIndex + 1);
        
        // 数値変換
        if (/^\d+$/.test(value)) {
          value = parseInt(value);
        } else if (/^\d+\.\d+$/.test(value)) {
          value = parseFloat(value);
        }
        
        args[key] = value;
      }
    }
    
    return { toolName, arguments: args };
  }

  async executeTool(toolName, args = {}) {
    await this.ensureReady();

    console.log(`\n🛠️ 実行: ${toolName}`);
    if (Object.keys(args).length > 0) {
      console.log(`📋 パラメータ: ${JSON.stringify(args)}`);
    }

    const beforeCount = this.responses.length;
    
    this.sendMcpMessage({
      jsonrpc: '2.0',
      id: this.getNextRequestId(),
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    });

    // レスポンス待機
    let attempts = 0;
    while (attempts < 30) { // 最大15秒待機
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const newResponses = this.responses.slice(beforeCount);
      const toolResponse = newResponses.find(r => r.result && r.result.content);
      
      if (toolResponse) {
        console.log('📥 結果:');
        if (toolResponse.result.content[0].text.length > 1000) {
          // 長いレスポンスは要約表示
          const text = toolResponse.result.content[0].text;
          console.log(text.substring(0, 500) + '\n... (省略) ...\n' + text.substring(text.length - 200));
          console.log(`\n📊 総文字数: ${text.length} 文字`);
        } else {
          console.log(toolResponse.result.content[0].text);
        }
        return toolResponse;
      }
      
      attempts++;
    }
    
    console.log('⚠️ タイムアウト: レスポンスが取得できませんでした');
    return null;
  }

  async ensureReady() {
    if (!this.mcpProcess) {
      await this.startMcpServer();
    }
    if (!this.isInitialized) {
      await this.initializeMcp();
    }
  }

  async startInteractiveMode() {
    await this.ensureReady();

    console.log('=== インタラクティブモード ===');
    console.log('💡 使用例:');
    console.log('  freee_current_user');
    console.log('  get_deals limit=5');
    console.log('  get_receipts start_date=2025-01-01 end_date=2025-12-31 limit=3');
    console.log('  get_receipts_by_id_download id=123456789');
    console.log('');
    console.log('📚 コマンド:');
    console.log('  help    - 詳細な使用例を表示');
    console.log('  exit    - 終了');
    console.log('  Ctrl+C  - 強制終了');
    console.log('');

    this.rl = createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const askForTool = () => {
      if (this.isShuttingDown) return;
      
      this.rl.question('🔧 ツール名を入力 > ', async (input) => {
        if (this.isShuttingDown) return;
        
        const trimmedInput = input.toLowerCase().trim();
        
        if (trimmedInput === 'exit') {
          this.shutdown();
          return;
        }

        if (trimmedInput === 'help') {
          showHelp();
          // 次の入力を待つ
          setTimeout(() => {
            if (!this.isShuttingDown) {
              askForTool();
            }
          }, 100);
          return;
        }

        if (input.trim()) {
          const parsed = this.parseToolInput(input);
          if (parsed) {
            await this.executeTool(parsed.toolName, parsed.arguments);
          }
        }
        
        // 次の入力を待つ
        setTimeout(() => {
          if (!this.isShuttingDown) {
            askForTool();
          }
        }, 100);
      });
    };

    askForTool();
  }

  shutdown() {
    if (this.isShuttingDown) return;
    
    this.isShuttingDown = true;
    console.log('\n👋 テスト終了');
    
    if (this.rl) {
      this.rl.close();
    }
    
    if (this.mcpProcess) {
      this.mcpProcess.kill();
    }
    
    process.exit(0);
  }

  // 一回だけのツール実行 (コマンドライン引数対応)
  async runSingleTool(toolName, args = {}) {
    try {
      await this.ensureReady();
      const result = await this.executeTool(toolName, args);
      this.shutdown();
      return result;
    } catch (error) {
      console.error('❌ エラー:', error);
      this.shutdown();
    }
  }
}

// ヘルプ表示
function showHelp() {
  console.log(`
🔧 freee MCP テストツール - 使い方

📋 基本的な使い方:

  # インタラクティブモード
  node scripts/test-mcp-simple.js

  # コマンドライン実行（一回だけ）
  node scripts/test-mcp-simple.js <ツール名> [パラメータ...]

💡 使用例:

  # 基本ツール
  node scripts/test-mcp-simple.js freee_current_user
  node scripts/test-mcp-simple.js freee_auth_status
  node scripts/test-mcp-simple.js freee_list_companies

  # データ取得
  node scripts/test-mcp-simple.js get_deals limit=5
  node scripts/test-mcp-simple.js get_receipts start_date=2025-01-01 end_date=2025-12-31 limit=3
  node scripts/test-mcp-simple.js get_companies

  # バイナリダウンロード
  node scripts/test-mcp-simple.js get_receipts_by_id_download id=123456789
  node scripts/test-mcp-simple.js get_journals_reports_by_id_download id=987654321

  # 仕訳帳生成 → ダウンロード
  node scripts/test-mcp-simple.js get_journals download_type=pdf start_date=2025-01-01 end_date=2025-03-31

📚 パラメータ形式:
  - key=value: get_deals limit=5
  - 複数パラメータ: get_receipts start_date=2025-01-01 end_date=2025-12-31 limit=3

🆘 オプション:
  --help, -h    このヘルプを表示
  --version     バージョン情報

🚀 Claude Code での推奨使用法:
  1. まず認証状態確認: node scripts/test-mcp-simple.js freee_auth_status
  2. データ取得テスト: node scripts/test-mcp-simple.js get_deals limit=5
  3. バイナリダウンロードテスト: node scripts/test-mcp-simple.js get_receipts_by_id_download id=123456789
`);
}

// メイン実行部分
async function main() {
  const tester = new FreeMcpTester();

  // Ctrl+C ハンドリング
  process.on('SIGINT', () => {
    tester.shutdown();
  });

  // エラーハンドリング
  process.on('uncaughtException', (error) => {
    console.error('❌ 未処理の例外:', error);
    tester.shutdown();
  });

  // コマンドライン引数処理
  const args = process.argv.slice(2);
  
  // ヘルプ表示
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    if (args.includes('--help') || args.includes('-h')) {
      showHelp();
      return;
    }
  }

  // バージョン情報
  if (args.includes('--version')) {
    console.log('freee MCP テストツール v1.0.0');
    return;
  }

  // コマンドライン引数で一回だけの実行
  if (args.length > 0) {
    const toolName = args[0];
    const toolArgs = {};
    
    // key=value 形式の引数を解析
    for (let i = 1; i < args.length; i++) {
      const arg = args[i];
      const eqIndex = arg.indexOf('=');
      if (eqIndex > 0) {
        const key = arg.substring(0, eqIndex);
        let value = arg.substring(eqIndex + 1);
        
        if (/^\d+$/.test(value)) {
          value = parseInt(value);
        } else if (/^\d+\.\d+$/.test(value)) {
          value = parseFloat(value);
        }
        
        toolArgs[key] = value;
      }
    }
    
    await tester.runSingleTool(toolName, toolArgs);
  } else {
    // インタラクティブモード
    await tester.startInteractiveMode();
  }
}

main().catch(console.error);