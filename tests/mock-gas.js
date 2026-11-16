// Simulation de Google Sheets / Apps Script pour tester Code.gs + Commun.gs
const fs = require('fs'), vm = require('vm');
function colIdx(l){let n=0;for(const ch of l)n=n*26+ch.charCodeAt(0)-64;return n;}
function creer(dir) {
  const sheets = {}; let tz = 'UTC'; let ordre = [];
  const ctx = { console };
  vm.createContext(ctx);
  const D = vm.runInContext('Date', ctx);
  class Sheet { constructor(n){this.name=n;this.d=[];}
    getName(){return this.name}
    deleteRow(r){this.d.splice(r-1,1)}
    getLastRow(){for(let r=this.d.length;r>0;r--){if((this.d[r-1]||[]).some(v=>v!==''&&v!==undefined))return r;}return 0}
    appendRow(v){ this.d[this.getLastRow()] = v.slice(); return this; }
    getLastColumn(){let m=0;this.d.forEach(r=>{for(let c=r.length;c>0;c--)if(r[c-1]!==''&&r[c-1]!==undefined){m=Math.max(m,c);break;}});return m}
    getMaxRows(){return 1000}
    getRange(a,b,c,d){ if(typeof a==='string'){ const m=a.match(/^([A-Z]+)(\d*)(?::([A-Z]+)(\d*))?$/);
        const c1=colIdx(m[1]), r1=m[2]?+m[2]:1, c2=m[3]?colIdx(m[3]):c1, r2=m[4]?+m[4]:(m[2]&&!m[3]?r1:1000);
        return new Range(this,r1,c1,r2-r1+1,c2-c1+1);} return new Range(this,a,b,c||1,d||1);}
    getDataRange(){return new Range(this,1,1,Math.max(this.getLastRow(),1),Math.max(this.getLastColumn(),1))}
    hideSheet(){} clear(){this.d=[]} clearConditionalFormatRules(){} setConditionalFormatRules(){} setFrozenRows(){} setFrozenColumns(){} autoResizeColumns(){} setColumnWidth(){} }
  class Range { constructor(s,r,c,nr,nc){Object.assign(this,{s,r,c,nr,nc})}
    getRow(){return this.r} getNumRows(){return this.nr} getSheet(){return this.s}
    getValues(){const o=[];for(let i=0;i<this.nr;i++){const row=[];for(let j=0;j<this.nc;j++){const v=(this.s.d[this.r-1+i]||[])[this.c-1+j];row.push(v===undefined?'':v)}o.push(row)}return o}
    getDisplayValues(){return this.getValues().map(r=>r.map(v=>v instanceof D?v.toISOString().slice(0,10).split('-').reverse().join('/'):String(v)))}
    getValue(){return this.getValues()[0][0]} setValue(v){return this.setValues([[v]])}
    setValues(v){if(v.length!==this.nr||v[0].length!==this.nc)throw new Error(`dimensions ${v.length}x${v[0].length} != ${this.nr}x${this.nc}`);
      v.forEach((row,i)=>row.forEach((x,j)=>{const R=this.r-1+i;this.s.d[R]=this.s.d[R]||[];this.s.d[R][this.c-1+j]=x}));return this}
    clearContent(){for(let i=0;i<this.nr;i++)for(let j=0;j<this.nc;j++){const R=this.s.d[this.r-1+i];if(R)R[this.c-1+j]=''}return this}
    clearDataValidations(){return this}
    getFormulas(){return this.getValues().map(r=>r.map(()=>''))}
    setNumberFormat(){return this} setDataValidation(){return this} setFontWeight(){return this}setFontStyle(){return this} setFontColor(){return this} setBackground(){return this} setHorizontalAlignment(){return this} setWrap(){return this} setVerticalAlignment(){return this} }
  const ss = { getSheetByName:n=>sheets[n]||null, insertSheet:n=>{ordre.push(n);return (sheets[n]=new Sheet(n))}, getSheets:()=>Object.values(sheets),
    deleteSheet:s=>{delete sheets[s.name]; ordre=ordre.filter(x=>x!==s.name)}, setActiveSheet(){}, moveActiveSheet(){}, getName:()=>'BDD Test', getSpreadsheetTimeZone:()=>tz, setSpreadsheetTimeZone:t=>tz=t };
  const builder = {requireValueInList(){return builder},requireValueInRange(){return builder},setAllowInvalid(){return builder},whenTextEqualTo(){return builder},setBackground(){return builder},setRanges(){return builder},build(){return {}}};
  const props = {};
  Object.assign(ctx, {
    SpreadsheetApp:{getActive:()=>ss, getUi:()=>({alert:()=>'YES', ButtonSet:{YES_NO:1,OK:2}, Button:{YES:'YES'}, createMenu(){return {addItem(){return this},addSeparator(){return this},addToUi(){}}}}),
      newDataValidation:()=>builder, newConditionalFormatRule:()=>builder, flush(){}},
    Utilities:{ formatDate:(d,z,f)=>{const p=n=>String(n).padStart(2,'0'); return f==='yyyy-MM-dd'?`${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())}`:`${d.getUTCFullYear()}-${p(d.getUTCMonth()+1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`},
      parseDate:(s)=>new D(s+'T00:00:00Z'), getUuid:()=>'15ef-d8e1-8039-471f-9eef-0000',
      DigestAlgorithm:{MD5:'md5'}, Charset:{UTF_8:'utf8'},
      computeDigest:(a,t)=>Array.from(require('crypto').createHash('md5').update(t).digest()),
      base64Encode:(b)=>Buffer.from(Array.isArray(b)?b.map(x=>x&255):String(b)).toString('base64'), base64Decode:(t)=>Array.from(Buffer.from(t,'base64')), newBlob:(o,m,n)=>({o,m,n}), base64EncodeWebSafe:(b)=>Buffer.from(b.map(x=>x&255)).toString('base64url') },
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]||null,setProperty:(k,v)=>props[k]=v,deleteProperty:k=>delete props[k]})},
    Logger:{log:()=>{}},
    UrlFetchApp:{ fetch:(url,o)=>{ globalThis.__gemini=(globalThis.__gemini||0)+1; const fG=__dirname+'/gemini.json'; const r=(fs.existsSync(fG)&&JSON.parse(fs.readFileSync(fG,'utf8')))||{date_visite:'2026-11-11',ville:'Abidjan',commune:'Cocody',quartier:'Cocody Centre',medecins:[{titre:'Dr',nom:'Dosso',prenoms:'Esther',specialite:'Gynécologie',etablissement:'CHU de Cocody',telephone:'0707123456',adresse:'',quartier:'',commune:'',source:'cachet',confiance:0.9},{titre:'Pr',nom:'Nouveau',prenoms:'Test Scan',specialite:'cardiologie',etablissement:'CHU de Cocody',telephone:'0505998877',adresse:'',quartier:'',commune:'',source:'cachet',confiance:0.8}],pharmacies:[],remarques:'Commande de 10 boîtes'}; return { getResponseCode:()=>200, getContentText:()=>JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(r)}]}}]}) }; } },
    DriveApp:{ getFoldersByName:()=>({hasNext:()=>false}), createFolder:()=>({ createFile:(b)=>({ getId:()=>'FICHIER1', getUrl:()=>'https://drive.google.com/file/d/FICHIER1' }) }) },
    LockService:{getScriptLock:()=>({waitLock(){},tryLock(){return true},releaseLock(){}})},
    CacheService:{getScriptCache:()=>{const m=globalThis.__cache=globalThis.__cache||{};return{remove:k=>{delete m[k]},get:k=>m[k]||null,put:(k,v)=>{m[k]=v},getAll:ks=>{const o={};ks.forEach(k=>{if(m[k]!==undefined)o[k]=m[k]});return o},putAll:o=>{Object.assign(m,o)}}}},
    ContentService:{createTextOutput:t=>({t,setMimeType(){return this}}),MimeType:{JSON:'json'}} });
  vm.runInContext(['Commun','Geolocalisation','Api','Lecture','Ecriture','Administration','Fusion'].concat(fs.existsSync(dir+'Ocr.gs')?['Ocr']:[]).map(f=>fs.readFileSync(dir+f+'.gs','utf8')).join('\n'), ctx);
  return { ctx, sheets, ss, D };
}
module.exports = { creer };
