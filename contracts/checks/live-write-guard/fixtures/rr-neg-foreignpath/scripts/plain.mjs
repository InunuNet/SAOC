// fixture: an in-memory fake that needs no preload (plainfixture-fake)
class FakeStore { async set() {} }
await new FakeStore().set({ a: 1 });
