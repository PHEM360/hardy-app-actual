
const form = {
  type: 'Insurance',
  provider: 'Aviva',
  costAmount: undefined,
  reminders: [{ amount: 7 }],
  history: [{ action: 'test' }]
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
sanitiseForFirestore(form);
console.log('form after calling sanitiseForFirestore:', JSON.stringify(form, null, 2));

