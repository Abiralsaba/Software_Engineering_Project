'use strict';
// Read-only, reproducible internal endpoint matrix; no database or credential access.
const fs=require('node:fs');const path=require('node:path');
const {publicPaths}=require('../../src/assistant/identity');
function matrix(){
 const root=path.resolve(__dirname,'../..');const app=fs.readFileSync(path.join(root,'src/app.js'),'utf8');
 const files=Object.fromEntries([...app.matchAll(/const (\w+) = require\('\.\/routes\/(\w+)'\)/g)].map(m=>[m[1],m[2]]));const rows=[];
 for(const mount of app.matchAll(/app\.use\('(\/api\/[^']+)', (\w+)\)/g)){
  if(!files[mount[2]])continue;const file=`src/routes/${files[mount[2]]}.js`;const source=fs.readFileSync(path.join(root,file),'utf8');
  for(const route of source.matchAll(/router\.(get|post|put|patch|delete)\('([^']+)'/g)){
   const endpoint=mount[1]+(route[2]==='/'?'':route[2]);const publicInfo=route[1]==='get'&&publicPaths.some(p=>p.test(endpoint.replace(/:\w+/g,'123')));
   const line=source.slice(0,route.index).split('\n').length;
   rows.push({service_code:mount[1].split('/')[2],feature_or_endpoint:`${route[1].toUpperCase()} ${endpoint}`,access_level:publicInfo?'PUBLIC':'VERIFIED_NID_REQUIRED',requires_authentication:!publicInfo,requires_issued_nid:!publicInfo,allowed_for_nid_applicant:publicInfo,reason:publicInfo?'Explicit public information allowlist.':'Existing citizen/admin operation. Applicant denied by default; existing authorization unchanged.',enforcement_middleware:'applicantBoundary + legacy authMiddleware',evidence:`${file}:${line}`});
  }
 }
 return {note:'VERIFIED_NID_REQUIRED is an applicant exclusion policy, not a claim that legacy citizen signup verifies government issuance. Existing anonymous identity lookups, admission-by-exam and payment callbacks remain separate security backlog items. Applicant auth/application/assistant APIs are APPLICANT_ALLOWED with UUID ownership and live DB checks.',rows};
}
if(require.main===module){console.log(JSON.stringify(matrix(),null,2));require('../../src/config/db').end();}
module.exports={matrix};
