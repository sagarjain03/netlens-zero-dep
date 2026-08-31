import net from 'node:net'
import crypto from 'node:crypto'
import dns from 'node:dns/promises'
const u16 = n => Buffer.from([(n>>8)&0xff, n&0xff])
const ext = (t,d) => Buffer.concat([u16(t),u16(d.length),d])
function hello(host, withSNI){
  const e=[]
  if(withSNI&&host){const h=Buffer.from(host,'ascii');const en=Buffer.concat([Buffer.from([0]),u16(h.length),h]);e.push(ext(0,Buffer.concat([u16(en.length),en])))}
  const g=Buffer.concat([u16(0x001d),u16(0x0017),u16(0x0018)]);e.push(ext(0x000a,Buffer.concat([u16(g.length),g])))
  e.push(ext(0x000b,Buffer.from([1,0])))
  const s=Buffer.concat([u16(0x0403),u16(0x0503),u16(0x0603),u16(0x0804),u16(0x0805),u16(0x0806),u16(0x0401),u16(0x0501),u16(0x0601)])
  e.push(ext(0x000d,Buffer.concat([u16(s.length),s]))); e.push(ext(0xff01,Buffer.from([0])))
  const eb=Buffer.concat(e)
  const c=Buffer.concat([u16(0xc02b),u16(0xc02f),u16(0xc02c),u16(0xc030),u16(0xc013),u16(0xc014),u16(0x009c),u16(0x009d)])
  const b=Buffer.concat([u16(0x0303),crypto.randomBytes(32),Buffer.from([0]),u16(c.length),c,Buffer.from([1,0]),u16(eb.length),eb])
  const hs=Buffer.concat([Buffer.from([1,(b.length>>16)&0xff,(b.length>>8)&0xff,b.length&0xff]),b])
  return Buffer.concat([Buffer.from([0x16,3,1]),u16(hs.length),hs])
}
function getCert(ip, sniHost, withSNI){return new Promise(r=>{
  const s=net.connect({host:ip,port:443,timeout:6000});let buf=Buffer.alloc(0),d=false
  const fin=()=>{if(d)return;d=true;s.destroy()
    let o=0,cert=null,alert=null
    while(o+5<=buf.length){const t=buf[o],l=buf.readUInt16BE(o+3),bd=buf.subarray(o+5,o+5+l)
      if(t===0x15)alert=`alert ${bd[0]}/${bd[1]}`
      if(t===0x16){let p=0;while(p+4<=bd.length){const ht=bd[p],hl=(bd[p+1]<<16)|(bd[p+2]<<8)|bd[p+3]
        if(ht===0x0b&&!cert){const hb=bd.subarray(p+4,p+4+hl);const l1=(hb[3]<<16)|(hb[4]<<8)|hb[5];cert=hb.subarray(6,6+l1)}
        p+=4+hl}}
      o+=5+l}
    if(!cert)return r({err:alert||'no cert'})
    try{const x=new crypto.X509Certificate(cert);r({cn:x.subject.replace(/\n/g,','),san:(x.subjectAltName||'').slice(0,70)})}catch(e){r({err:e.message})}}
  s.on('connect',()=>s.write(hello(sniHost,withSNI)));s.on('data',c=>{buf=Buffer.concat([buf,c]);if(buf.length>5000)fin()})
  s.on('end',fin);s.on('timeout',fin);s.on('error',e=>{r({err:e.code});d=true});setTimeout(fin,5000)})}

const targets=['example.com','www.wikipedia.org','blog.cloudflare.com','medium.com','www.reddit.com','discord.com']
console.log('\n\x1b[1m  SNI HUNT — looking for a host where removing SNI changes the certificate\x1b[0m\n')
for(const t of targets){
  let ip; try{ip=(await dns.resolve4(t))[0]}catch{console.log(`  ${t.padEnd(24)} dns fail`);continue}
  const a=await getCert(ip,t,true), b=await getCert(ip,null,false)
  const same = a.cn && b.cn && a.cn===b.cn
  const mark = a.cn && !same ? '\x1b[32m🎯 DEMO HOST!\x1b[0m' : '\x1b[90m—\x1b[0m'
  console.log(`  \x1b[1m${t}\x1b[0m  (${ip})  ${mark}`)
  console.log(`    with SNI : ${a.cn||'\x1b[31m'+a.err+'\x1b[0m'}`)
  console.log(`    no SNI   : ${b.cn||'\x1b[31m'+b.err+'\x1b[0m'}`)
}
console.log('')
