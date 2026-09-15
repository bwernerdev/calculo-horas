const test = require("node:test");
const assert = require("node:assert/strict");
const { createLocalStorageRepository, createSupabaseRepository } = require("../repository.js");

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.has(key) ? values.get(key) : null,
    setItem: (key, value) => values.set(key, value)
  };
}

test("repositório grava e exclui somente o registro solicitado", () => {
  const repository = createLocalStorageRepository(memoryStorage(), { records:"records", settings:"settings" });
  const first = { id:"1", date:"2026-08-17" };
  const second = { id:"2", date:"2026-08-18" };
  repository.saveRecord(first);
  repository.saveRecord(second);
  repository.saveRecord({ ...first, type:"folga" });
  assert.deepEqual(repository.findAllRecords(), [{ ...first, type:"folga" }, second]);
  repository.deleteRecord("1");
  assert.deepEqual(repository.findAllRecords(), [second]);
});

test("restauração local troca registros e configurações em conjunto", () => {
  const repository = createLocalStorageRepository(memoryStorage(), { records:"records", settings:"settings" });
  const restored = [{ id:"novo", date:"2026-08-17" }];
  repository.restoreBackup(restored, { target:528, theme:"dark" });
  assert.deepEqual(repository.findAllRecords(), restored);
  assert.deepEqual(repository.getSettings(), { target:528, theme:"dark" });
});

test("repositório Supabase faz upsert e delete individuais", async () => {
  const calls=[];
  const client={
    storage:{ from:()=>({ download:async()=>({ data:null,error:null }), upload:async()=>({ error:null }), remove:async()=>({ error:null }) }) },
    from:(table)=>({
      upsert:(row,options)=>({ select:()=>({ single:async()=>({ data:row,error:null }) }), then:(resolve)=>resolve({ error:null }), row, options }),
      delete:()=>({ eq:async(column,value)=>{ calls.push(["delete",table,column,value]); return { error:null }; } })
    })
  };
  const repository=createSupabaseRepository(client,"user-1");
  const record={ id:"record-1", date:"2026-08-17", type:"folga", start:"", end:"", break:0, photos:{} };
  const saved=await repository.saveRecord(record);
  assert.equal(saved.id,"record-1");
  await repository.deleteRecord("record-1");
  assert.deepEqual(calls,[["delete","records","id","record-1"]]);
});

test("repositório chama a função transacional ao restaurar backup", async () => {
  let rpcCall;
  const client={
    storage:{ from:()=>({ download:async()=>({ data:null,error:null }), upload:async()=>({ error:null }), remove:async()=>({ error:null }) }) },
    rpc:async(name,parameters)=>{ rpcCall={ name,parameters }; return { error:null }; }
  };
  const repository=createSupabaseRepository(client,"user-1");
  const records=[{ id:"record-1", date:"2026-08-17", type:"folga", start:"", end:"", break:0, photos:{} }];
  await repository.restoreBackup(records,{ target:528,theme:"light",manualBalances:{ "2026-08":{ positive:90,negative:30 } } });
  assert.equal(rpcCall.name,"restore_user_backup");
  assert.equal(rpcCall.parameters.p_records.length,1);
  assert.equal(rpcCall.parameters.p_target_minutes,528);
  assert.deepEqual(rpcCall.parameters.p_balance_adjustments,{ "2026-08":{ positive:90,negative:30 } });
});

test("repositório Supabase sincroniza os saldos manuais nas configurações", async () => {
  let selectedColumns, savedRow;
  const client={
    storage:{ from:()=>({}) },
    from:()=>({
      select:(columns)=>{ selectedColumns=columns; return { maybeSingle:async()=>({ data:{ target_minutes:528,theme:"dark",balance_adjustments:{ "2026-09":{ positive:75,negative:15 } } },error:null }) }; },
      upsert:async(row)=>{ savedRow=row; return { error:null }; }
    })
  };
  const repository=createSupabaseRepository(client,"user-1");
  const settings=await repository.getSettings();
  assert.match(selectedColumns,/balance_adjustments/);
  assert.deepEqual(settings.manualBalances,{ "2026-09":{ positive:75,negative:15 } });
  await repository.saveSettings(settings);
  assert.deepEqual(savedRow.balance_adjustments,settings.manualBalances);
});
