
const BLANK = {
  type: '',
  provider: '',
  costAmount: undefined,
  reminders: [{ amount: 7 }],
  history: []
};
function sanitiseForFirestore(data) {
  const out = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      out[k] = v.map((el) =>
        el && typeof el === 'object' ? sanitiseForFirestore(el) : el
      );
    } else if (v && typeof v === 'object' && !(v instanceof Date)) {
      out[k] = sanitiseForFirestore(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}
let form = BLANK;
const setForm = (fn) => { form = fn(form); };

setForm(f => ({ ...f, provider: 'Test' }));
sanitiseForFirestore(form);
console.log('BLANK after save:', BLANK);

