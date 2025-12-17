export function info(msg: string) { console.log(msg); }
export function error(msg: string) { console.error(msg); }
export function table(rows: Array<Record<string, unknown>>) { for (const r of rows) console.log(JSON.stringify(r)); }
