(() => {
  'use strict';
  const RATES = { '201': { '1000':37000, '1200':39400 }, '304': { '1000':47000, '1200':51400 } };
  const COLUMN_PRICE = 15000;
  const STORAGE_KEY = 'kd-rail-estimate-2026-v1';
  const $ = id => document.getElementById(id);
  const comma = num => Number(num).toLocaleString('ko-KR');
  const money = num => comma(num) + '원';
  const limits = {length:[1,999],qty:[1,999],ends:[0,2],middle:[0,999],extraAmount:[0,100000000]};
  let records = [];
  let editing = null;
  let toastTimer;

  function clampInteger(value,min,max,defaultValue=min) {
    const n=Number(value);
    return value==='' || !Number.isFinite(n) ? defaultValue : Math.max(min,Math.min(max,Math.round(n)));
  }
  function radio(name){ return document.querySelector(`input[name="${name}"]:checked`).value; }
  function normalizeField(id) {
    const el=$(id),[min,max]=limits[id];
    el.value=String(clampInteger(el.value,min,max));
  }
  function getForm(){
    return {
      material: radio('material'), height:radio('height'),
      length:clampInteger($('length').value,1,999), qty:clampInteger($('qty').value,1,999),
      ends:clampInteger($('ends').value,0,2), middle:clampInteger($('middle').value,0,999),
      extra:clampInteger($('extraAmount').value,0,100000000),
      vat: $('vatOn').checked,
      name:$('name').value.trim().slice(0,100), memo:$('memo').value.trim().slice(0,200)
    };
  }
  function calculate(rec) {
    const rate = RATES[rec.material][rec.height];
    const base=rec.length*rate;
    const columns=(rec.ends+rec.middle)*COLUMN_PRICE;
    const one=base+columns+rec.extra;
    const supply=one*rec.qty;
    const tax=rec.vat?Math.round(supply*.1):0;
    return {rate,base,columns,one,supply,tax,total:supply+tax};
  }
  function renderLive(){
    const rec=getForm(), cost=calculate(rec);
    $('selectedMat').textContent='SUS '+rec.material;
    $('selectedHeight').textContent='높이 '+rec.height+'mm';
    $('visualLength').innerHTML='계산 길이 <b>'+rec.length+'m</b>';
    $('unitPrice').textContent=money(cost.rate);
    $('baseLabel').textContent=`본체 ${rec.length}m × ${comma(cost.rate)}원`;
    $('baseTotal').textContent=money(cost.base);
    $('columnLabel').textContent=`기둥 추가 (${rec.ends+rec.middle}개 × 15,000원)`;
    $('columnTotal').textContent=money(cost.columns);
    $('extraTotal').textContent=money(rec.extra);
    $('oneTotal').textContent=money(cost.one);
    $('qtyLabel').textContent=`수량 ${rec.qty}개 합계`;
    $('supplyTotal').textContent=money(cost.supply);
    $('vatTotal').textContent=money(cost.tax);
    $('vatHint').textContent=rec.vat?'부가세 10% 포함':'부가세 미포함';
    $('finalTotal').textContent=comma(cost.total);
    $('bottomTotal').textContent=comma(cost.total);
  }
  function esc(text) {
    return String(text||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function validRecord(value) {
    if (!value || typeof value!=='object') return null;
    const material=String(value.material),height=String(value.height);
    if(!RATES[material] || !RATES[material][height]) return null;
    const rec={material,height,
      length:clampInteger(value.length,1,999),qty:clampInteger(value.qty,1,999),
      ends:clampInteger(value.ends,0,2),middle:clampInteger(value.middle,0,999),
      extra:clampInteger(value.extra,0,100000000),vat:value.vat===true,
      name:String(value.name||'').slice(0,100),memo:String(value.memo||'').slice(0,200),
      id:String(value.id || ('q'+Date.now()+'-'+Math.random())).slice(0,80)
    };
    return rec;
  }
  function persist() {
    try {localStorage.setItem(STORAGE_KEY,JSON.stringify(records));return true;}
    catch(err){notice('브라우저 저장 공간을 확인하세요. 백업 파일 저장을 권장합니다.');return false;}
  }
  function load(){
    try {
      const parsed=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');
      if(Array.isArray(parsed))records=parsed.slice(0,500).map(validRecord).filter(Boolean);
    } catch(err){records=[];notice('저장 데이터를 불러오지 못했습니다.');}
  }
  function notice(message){
    const el=$('toast');el.textContent=message;el.classList.add('active');
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('active'),3300);
  }
  function renderList(){
    $('listCount').textContent=records.length+'건';
    const tbody=$('quoteRows');
    if(!records.length)tbody.innerHTML='<tr class="empty-row"><td colspan="7">견적을 추가하면 여기에 표시됩니다.</td></tr>';
    else tbody.innerHTML=records.map((r,idx)=>{
      const t=calculate(r);
      const subName=[r.name,r.memo].filter(Boolean).join(' / ');
      return `<tr>
        <td>${idx+1}</td>
        <td><strong>SUS ${r.material} / ${r.height}mm</strong><small>0.9T${subName?' · '+esc(subName):''}</small></td>
        <td><strong>${r.length}m</strong></td>
        <td>끝 ${r.ends}개 / 중간 ${r.middle}개</td>
        <td>${r.qty}개</td>
        <td><strong>${money(t.total)}</strong><small>${r.vat?'VAT 포함':'VAT 미포함'}</small></td>
        <td class="no-print"><button type="button" data-edit="${idx}" aria-label="${idx+1}번 견적 수정">수정</button><button type="button" class="del" data-delete="${idx}" aria-label="${idx+1}번 견적 삭제">삭제</button></td>
      </tr>`;
    }).join('');
    const sum=records.reduce((acc,r)=>acc+calculate(r).total,0);
    $('listTotal').textContent=comma(sum);
    ['copyAll','printQuotes','clearList'].forEach(id=>$(id).disabled=!records.length);
    $('addQuote').textContent=editing===null?'+ 견적 목록에 추가':'✓ 수정 완료';
  }
  function resetForm(){
    editing=null;
    document.querySelector('input[name="material"][value="201"]').checked=true;
    document.querySelector('input[name="height"][value="1000"]').checked=true;
    ['length','qty'].forEach(k=>$(k).value='1');
    ['ends','middle','extraAmount'].forEach(k=>$(k).value='0');
    ['name','memo'].forEach(k=>$(k).value='');
    $('vatOn').checked=false;
    renderLive();renderList();
  }
  function setForm(rec){
    document.querySelector(`input[name="material"][value="${rec.material}"]`).checked=true;
    document.querySelector(`input[name="height"][value="${rec.height}"]`).checked=true;
    ['length','qty','ends','middle'].forEach(key=>$(key).value=rec[key]);
    $('extraAmount').value=rec.extra;$('name').value=rec.name;$('memo').value=rec.memo;
    $('vatOn').checked=rec.vat;
    renderLive();
  }
  function addQuote(){
    ['length','qty','ends','middle','extraAmount'].forEach(normalizeField);
    const rec=validRecord({...getForm(),id:editing===null?('q'+Date.now()+'-'+Math.random()):records[editing].id});
    if(editing===null){ if(records.length>=500){notice('견적은 최대 500건까지 저장됩니다.');return;}records.push(rec); }
    else records[editing]=rec;
    const msg=editing===null?'견적이 목록에 추가되었습니다.':'견적이 수정되었습니다.';
    editing=null;persist();renderList();renderLive();notice(msg);
  }
  function reportText(){
    const lines=['[강동자바라 스텐 난간대 견적서]','기본형 · 파이프 두께 0.9T',''];
    records.forEach((r,i)=>{
      const c=calculate(r);
      lines.push(`${i+1}. SUS${r.material} / 높이 ${r.height}mm / 길이 ${r.length}m / 수량 ${r.qty}개`);
      lines.push(`   본체: ${money(c.base)} / 끝기둥 ${r.ends}개 / 중간기둥 ${r.middle}개`);
      if(r.extra)lines.push(`   기타 추가금(1개당): ${money(r.extra)}`);
      if(r.name)lines.push(`   현장·고객명: ${r.name}`);
      if(r.memo)lines.push(`   메모: ${r.memo}`);
      lines.push(`   합계: ${money(c.total)} (${r.vat?'부가세 포함':'부가세 미포함'})`,'');
    });
    lines.push(`전체 합계: ${money(records.reduce((sum,r)=>sum+calculate(r).total,0))}`);
    lines.push('※ 배송·설치 별도. 기본 단가의 부가세 포함 여부 미확인.');
    return lines.join('\n');
  }
  async function copyReport(){
    const value=reportText();
    try {
      if(navigator.clipboard && window.isSecureContext)await navigator.clipboard.writeText(value);
      else {
        const ta=document.createElement('textarea');ta.value=value;ta.style.position='fixed';ta.style.opacity='0';document.body.append(ta);ta.select();
        const ok=document.execCommand('copy');ta.remove();if(!ok)throw new Error('copy failed');
      }
      notice('견적 내용이 복사되었습니다.');
    }catch(err){notice('복사가 차단되었습니다. HTTPS 주소에서 다시 시도하세요.');}
  }
  function exportData(){
    const payload={app:'kd-rail-estimate',version:1,exportedAt:new Date().toISOString(),records};
    const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob),anchor=document.createElement('a');
    anchor.href=url;anchor.download='강동자바라_난간대견적_백업_'+new Date().toISOString().slice(0,10)+'.json';
    document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);
    notice('백업 파일을 저장했습니다.');
  }
  async function importData(file){
    if(!file)return;
    try{
      const parsed=JSON.parse(await file.text());
      if(parsed.app!=='kd-rail-estimate'||!Array.isArray(parsed.records)||parsed.records.length>500)throw new Error('invalid');
      const valid=parsed.records.map(validRecord);
      if(valid.some(r=>r===null))throw new Error('invalid record');
      if(!confirm(`기존 견적 ${records.length}건을 백업 데이터 ${valid.length}건으로 교체할까요?`))return;
      records=valid;editing=null;persist();renderList();notice('백업 데이터를 복원했습니다.');
    }catch(err){notice('올바른 견적 백업 파일인지 확인해주세요.');}
  }
  document.querySelectorAll('input[name="material"],input[name="height"],#vatOn').forEach(el=>el.addEventListener('change',renderLive));
  ['length','qty','ends','middle','extraAmount','name','memo'].forEach(id=>{
    $(id).addEventListener('input',renderLive);
    if(limits[id])$(id).addEventListener('change',()=>{normalizeField(id);renderLive();});
  });
  document.querySelectorAll('[data-step]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.step, [min,max]=limits[id];
    $(id).value=clampInteger(clampInteger($(id).value,min,max)+Number(btn.dataset.delta),min,max);
    renderLive();
  }));
  $('addQuote').addEventListener('click',addQuote);
  $('resetForm').addEventListener('click',resetForm);
  $('quoteRows').addEventListener('click',e=>{
    const btn=e.target.closest('button');if(!btn)return;
    if(btn.dataset.edit!==undefined){
      editing=Number(btn.dataset.edit);setForm(records[editing]);renderList();
      document.querySelector('.edit-card').scrollIntoView({behavior:'smooth',block:'start'});
      notice('왼쪽 입력란에서 수정 후 「수정 완료」를 누르세요.');
    }
    if(btn.dataset.delete!==undefined){
      const idx=Number(btn.dataset.delete);
      if(confirm(`${idx+1}번 견적을 삭제할까요?`)){records.splice(idx,1);editing=null;persist();renderList();notice('삭제했습니다.');}
    }
  });
  $('copyAll').addEventListener('click',copyReport);
  $('printQuotes').addEventListener('click',()=>window.print());
  $('clearList').addEventListener('click',()=>{
    if(confirm('저장된 견적 목록을 모두 삭제할까요? 삭제 전 백업을 권장합니다.')){records=[];editing=null;persist();renderList();notice('목록을 비웠습니다.');}
  });
  $('exportData').addEventListener('click',exportData);
  $('importData').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',e=>{importData(e.target.files[0]);e.target.value='';});
  load();renderLive();renderList();
})();
