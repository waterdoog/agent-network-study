import test from 'node:test';
import assert from 'node:assert/strict';
import {toResponses,readResponse,toChat} from '../../src/lib/subscription.js';

test('history round trip preserves tools, arguments, outputs and instructions',()=>{
  const messages=[{role:'system',content:'Original system prompt'},
    {role:'user',content:'Original task'},
    {role:'assistant',content:null,tool_calls:[{id:'call_x',type:'function',function:{name:'ask_agent',arguments:'{"id":"a"}'}}]},
    {role:'tool',tool_call_id:'call_x',content:'original result'},
    {role:'assistant',content:'continue'}];
  const body=toResponses({messages,maxTokens:6000,temperature:0.3,
    tools:[{type:'function',function:{name:'ask_agent',description:'original description',parameters:{type:'object',properties:{id:{type:'string'}}}}}]});
  assert.equal(body.instructions,messages[0].content);
  assert.equal(body.input[1].call_id,'call_x');
  assert.equal(body.input[2].output,'original result');
  assert.equal(body.input[3].content[0].type,'output_text');
  assert.equal(body.tools[0].description,'original description');
  assert.equal(body.max_output_tokens,6000);
  assert.equal(body.model,'gpt-6-astra');
  assert.ok(!('temperature' in body));
});

test('SSE output is retained when terminal response.output is empty',async()=>{
  const events=[{type:'response.output_item.done',output_index:0,item:{type:'function_call',call_id:'call_1',name:'submit',arguments:'{"html":"hello"}'}},
    {type:'response.completed',response:{model:'gpt-6-astra',status:'completed',output:[],usage:{input_tokens:10,output_tokens:20}}}];
  const text=events.map(x=>`data: ${JSON.stringify(x)}\n\n`).join('');
  const stream=new ReadableStream({start(c){for(let i=0;i<text.length;i+=7)c.enqueue(new TextEncoder().encode(text.slice(i,i+7)));c.close();}});
  const result=await readResponse(new Response(stream));
  assert.equal(result.final.model,'gpt-6-astra');
  const message=toChat(result.output);
  assert.equal(message.tool_calls[0].id,'call_1');
  assert.equal(message.tool_calls[0].function.arguments,'{"html":"hello"}');
});

test('truncated SSE is a technical error, never a successful empty answer',async()=>{
  await assert.rejects(readResponse(new Response('data: {"type":"response.in_progress"}\n\n')),/terminal response/);
});
