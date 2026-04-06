#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path');
const log=path.join(require('os').tmpdir(),'mcp-debug-io.log');
fs.writeFileSync(log,'START '+Date.now()+'\n');
process.stdin.setEncoding('utf-8');
let b='';
process.stdin.on('data',function(c){
  fs.appendFileSync(log,'IN:'+c.substring(0,200)+'\n');
  b+=c;
  while(true){
    var h=b.indexOf('\r\n\r\n');
    if(h===-1)break;
    var m=b.substring(0,h).match(/Content-Length:\s*(\d+)/i);
    if(!m){b=b.substring(h+4);continue;}
    var len=parseInt(m[1]),s=h+4;
    if(b.length<s+len)break;
    var body=b.substring(s,s+len);b=b.substring(s+len);
    try{
      var msg=JSON.parse(body);
      fs.appendFileSync(log,'METHOD:'+msg.method+'\n');
      if(msg.method==='initialize'){
        var r=JSON.stringify({jsonrpc:'2.0',id:msg.id,result:{protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'dbg',version:'1.0'}}});
        process.stdout.write('Content-Length: '+Buffer.byteLength(r)+'\r\n\r\n'+r);
        fs.appendFileSync(log,'SENT:init\n');
      }else if(msg.method==='tools/list'){
        var r2=JSON.stringify({jsonrpc:'2.0',id:msg.id,result:{tools:[{name:'test_tool',description:'A test',inputSchema:{type:'object',properties:{x:{type:'string'}},required:['x']}}]}});
        process.stdout.write('Content-Length: '+Buffer.byteLength(r2)+'\r\n\r\n'+r2);
        fs.appendFileSync(log,'SENT:tools\n');
      }else if(msg.method==='notifications/initialized'){
        fs.appendFileSync(log,'GOT:initialized\n');
      }else{
        fs.appendFileSync(log,'UNKNOWN:'+msg.method+'\n');
      }
    }catch(e){fs.appendFileSync(log,'ERR:'+e.message+'\n');}
  }
});
process.stdin.resume();
