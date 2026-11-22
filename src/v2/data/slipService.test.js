// The photo store is faked: it refuses 'payments/' the way Firebase does while
// the new storage rules are not yet published.
jest.mock('../../firebase', () => ({}));
const mockUploaded = [];
let mockRefuse = () => false;
jest.mock('firebase/storage', () => ({
  getStorage: () => ({}),
  ref: (_s, path) => ({ path }),
  getDownloadURL: async () => 'url',
  uploadBytes: async (r) => { if (mockRefuse(r.path)) { const e = new Error('no'); e.code = 'storage/unauthorized'; throw e; } mockUploaded.push(r.path); },
}));
const { keepPhoto, photoError } = require('./slipService');

beforeEach(() => { mockUploaded.length = 0; mockRefuse = () => false; });

test('a payment photo goes under payments/ when allowed', async () => {
  const path = await keepPhoto({}, '2026-11-22', 'payments');
  expect(path).toMatch(/^payments\/2026-11\/2026-11-22-.+\.jpg$/);
});
test('if payments/ is refused, the photo is kept with the slip photos instead', async () => {
  mockRefuse = (p) => p.startsWith('payments/');
  const path = await keepPhoto({}, '2026-11-22', 'payments');
  expect(path).toMatch(/^slips\/2026-11\/payments-2026-11-22-.+\.jpg$/);
  expect(mockUploaded).toEqual([path]);
});
test('if everything is refused, the error says the rules need publishing', async () => {
  mockRefuse = () => true;
  const e = await keepPhoto({}, '2026-11-22', 'payments').catch((x) => x);
  expect(photoError(e)).toMatch(/storage rules in Firebase need publishing/);
});
test('harvest slip photos are unchanged', async () => {
  expect(await keepPhoto({}, '2026-11-22')).toMatch(/^slips\/2026-11\/2026-11-22-/);
});
