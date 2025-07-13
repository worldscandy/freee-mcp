#!/usr/bin/env node

/**
 * MCP Server 動作確認スクリプト
 * freee MCP serverのツールをテストするためのスクリプト
 */

import { spawn } from 'child_process';
import { createInterface } from 'readline';

// MCP メッセージを送信するヘルパー関数
function sendMcpMessage(process, message) {
  const jsonMessage = JSON.stringify(message);
  console.log(`\n📤 送信: ${jsonMessage}`);
  process.stdin.write(jsonMessage + '\n');
}

// MCP リクエストIDを生成
let requestId = 1;
function getNextRequestId() {
  return requestId++;
}

async function testMcpTools() {
  console.log('🚀 freee MCP Server 動作確認を開始します...\n');

  // MCP serverプロセスを起動
  const mcpProcess = spawn('pnpm', ['tsx', 'src/index.ts'], {
    stdio: 'pipe',
    cwd: process.cwd()
  });

  // 標準出力の監視 - 大きなJSONレスポンス対応
  let accumulatedData = '';
  const responses = [];
  
  mcpProcess.stdout.on('data', (data) => {
    accumulatedData += data.toString();
    const lines = accumulatedData.split('\n');
    
    // 最後の不完全な行は次回まで保持
    accumulatedData = lines.pop() || '';
    
    lines.forEach((line) => {
      if (line.trim()) {
        try {
          const response = JSON.parse(line);
          console.log('📥 Response received:', JSON.stringify(response, null, 2));
          responses.push(response);
        } catch (error) {
          // JSONが大きすぎて分割されている場合の処理
          if (line.includes('"tools":[') && !line.includes(']}}')) {
            console.log('📥 Large tools response detected, accumulating...');
            accumulatedData = line + accumulatedData;
          } else {
            console.log('⚠️ Non-JSON data:', line.substring(0, 200) + (line.length > 200 ? '...' : ''));
          }
        }
      }
    });
  });

  // 標準エラー出力の監視（ログ用）
  mcpProcess.stderr.on('data', (data) => {
    console.log(`📋 ログ: ${data.toString().trim()}`);
  });

  // プロセス終了時の処理
  mcpProcess.on('exit', (code) => {
    console.log(`\n🏁 MCP Server プロセスが終了しました (コード: ${code})`);
  });

  // 少し待ってからテスト開始
  await new Promise(resolve => setTimeout(resolve, 2000));

  console.log('\n=== MCP 初期化テスト ===');

  // 1. Initialize request
  sendMcpMessage(mcpProcess, {
    jsonrpc: '2.0',
    id: getNextRequestId(),
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      clientInfo: {
        name: 'freee-mcp-test-client',
        version: '1.0.0'
      }
    }
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // 2. List tools
  console.log('\n=== 利用可能ツール一覧取得 ===');
  sendMcpMessage(mcpProcess, {
    jsonrpc: '2.0',
    id: getNextRequestId(),
    method: 'tools/list',
    params: {}
  });

  await new Promise(resolve => setTimeout(resolve, 1000));

  // 3. Test freee_status tool
  console.log('\n=== freee_status ツールテスト ===');
  sendMcpMessage(mcpProcess, {
    jsonrpc: '2.0',
    id: getNextRequestId(),
    method: 'tools/call',
    params: {
      name: 'freee_status',
      arguments: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // 4. Test freee_list_companies tool
  console.log('\n=== freee_list_companies ツールテスト ===');
  sendMcpMessage(mcpProcess, {
    jsonrpc: '2.0',
    id: getNextRequestId(),
    method: 'tools/call',
    params: {
      name: 'freee_list_companies',
      arguments: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // 5. Test freee_auth_status tool
  console.log('\n=== freee_auth_status ツールテスト ===');
  sendMcpMessage(mcpProcess, {
    jsonrpc: '2.0',
    id: getNextRequestId(),
    method: 'tools/call',
    params: {
      name: 'freee_auth_status',
      arguments: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // 6. Test freee_help tool
  console.log('\n=== freee_help ツールテスト ===');
  sendMcpMessage(mcpProcess, {
    jsonrpc: '2.0',
    id: getNextRequestId(),
    method: 'tools/call',
    params: {
      name: 'freee_help',
      arguments: {}
    }
  });

  await new Promise(resolve => setTimeout(resolve, 2000));

  // インタラクティブモード
  console.log('\n=== インタラクティブモード ===');
  console.log('ツール名を入力してテストしてください');
  console.log('');
  console.log('📋 使用例:');
  console.log('  freee_current_user');
  console.log('  get_receipts start_date=2024-01-01 end_date=2024-12-31 limit=3');
  console.log('  get_api_1_receipts_123_download');
  console.log('');
  console.log('💡 JSON形式も可能:');
  console.log('  get_receipts {"start_date":"2024-01-01","end_date":"2024-12-31","limit":3}');
  console.log('');
  console.log('終了するには "exit" と入力してください\n');

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const parseToolInput = (input) => {
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
        
        // 数値かどうか判定
        if (/^\d+$/.test(value)) {
          value = parseInt(value);
        } else if (/^\d+\.\d+$/.test(value)) {
          value = parseFloat(value);
        }
        
        args[key] = value;
      }
    }
    
    return { toolName, arguments: args };
  };

  const askForTool = () => {
    rl.question('ツール名を入力 > ', (input) => {
      if (input.toLowerCase().trim() === 'exit') {
        console.log('\n👋 テスト終了');
        mcpProcess.kill();
        rl.close();
        process.exit(0);
      }

      if (input.trim()) {
        const parsed = parseToolInput(input);
        if (parsed) {
          const { toolName, arguments: args } = parsed;
          console.log(`\n=== ${toolName} ツールテスト ===`);
          
          if (Object.keys(args).length > 0) {
            console.log(`📋 パラメータ: ${JSON.stringify(args)}`);
          }
          
          sendMcpMessage(mcpProcess, {
            jsonrpc: '2.0',
            id: getNextRequestId(),
            method: 'tools/call',
            params: {
              name: toolName,
              arguments: args
            }
          });
        }
        
        setTimeout(() => {
          askForTool();
        }, 2000);
      } else {
        askForTool();
      }
    });
  };

  askForTool();
}

// エラーハンドリング
process.on('uncaughtException', (error) => {
  console.error('❌ 未処理の例外:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ 未処理のPromise拒否:', reason);
});

// テスト開始
testMcpTools().catch(console.error);