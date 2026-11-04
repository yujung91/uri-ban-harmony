// Stage one deliberately has no database, storage or authenticated identity.
// Never forward Sites credentials or bind the existing production D1/R2 here.
export const env = { HARMONY_RUNTIME: "vercel" };
