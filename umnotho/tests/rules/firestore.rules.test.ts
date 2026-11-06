import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import type { RulesTestEnvironment } from '@firebase/rules-unit-testing';
import {
  addDoc,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

let testEnv: RulesTestEnvironment;

const ITEM = {
  ownerId: 'owner',
  ownerName: 'Owner',
  name: 'Mountain bike',
  description: 'A reliable bike with new tyres and a lock.',
  estimatedValue: 1500,
  city: 'Cape Town',
  type: 'goods',
  isBusinessBid: false,
  inquiries: [],
  votes: {},
  createdAt: new Date(),
};

function newItem(overrides: Record<string, unknown> = {}) {
  return { ...ITEM, ownerId: 'buyer', ownerName: 'Buyer', createdAt: serverTimestamp(), ...overrides };
}

function newBid(overrides: Record<string, unknown> = {}) {
  return {
    itemId: 'item1',
    itemName: ITEM.name,
    itemDescription: ITEM.description,
    itemValue: ITEM.estimatedValue,
    city: ITEM.city,
    type: ITEM.type,
    isBusinessBid: false,
    ownerId: 'owner',
    ownerName: 'Owner',
    bidderId: 'buyer',
    bidderName: 'Buyer',
    offer: 'R1,200 and a service',
    status: 'Pending',
    messages: [],
    createdAt: serverTimestamp(),
    lastUpdated: serverTimestamp(),
    ...overrides,
  };
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-umnotho',
    firestore: {
      host: '127.0.0.1',
      port: 8080,
      rules: readFileSync(resolve(process.cwd(), 'firestore.rules'), 'utf8'),
    },
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, 'users', 'owner'), {
      displayName: 'Owner',
      email: 'owner@example.com',
      ratings: {},
      createdAt: new Date(),
    });
    await setDoc(doc(db, 'users', 'buyer'), {
      displayName: 'Buyer',
      email: 'buyer@example.com',
      ratings: {},
      createdAt: new Date(),
    });
    await setDoc(doc(db, 'barterItems', 'item1'), ITEM);
    await setDoc(doc(db, 'payments', 'pay1'), {
      ownerId: 'buyer',
      plan: 'basic',
      amountZar: 49,
      amountUsdt: 2.65,
      status: 'pending',
      provider: 'sandbox',
      providerPaymentId: 'sandbox_pay1',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe('users', () => {
  it('lets owners read their own profile only, and blocks user enumeration', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    const ownerDb = testEnv.authenticatedContext('owner').firestore();
    const anonDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(getDoc(doc(buyerDb, 'users', 'buyer')));
    await assertSucceeds(getDoc(doc(ownerDb, 'users', 'owner')));
    await assertFails(getDoc(doc(buyerDb, 'users', 'owner')));
    await assertFails(getDoc(doc(anonDb, 'users', 'owner')));
    await assertFails(getDocs(collection(buyerDb, 'users')));
  });

  it('creates a profile only for the signed-in user and with safe fields', async () => {
    const newbieDb = testEnv.authenticatedContext('newbie').firestore();
    const otherDb = testEnv.authenticatedContext('other').firestore();
    const profile = {
      displayName: 'Newbie',
      email: 'newbie@example.com',
      ratings: {},
      createdAt: serverTimestamp(),
    };

    await assertSucceeds(setDoc(doc(newbieDb, 'users', 'newbie'), profile));
    await assertFails(setDoc(doc(newbieDb, 'users', 'someone-else'), profile));
    await assertFails(setDoc(doc(otherDb, 'users', 'other'), { ...profile, role: 'admin' }));
  });

  it('does not let a user change their own role or reputation', async () => {
    const ownerDb = testEnv.authenticatedContext('owner').firestore();

    await assertFails(updateDoc(doc(ownerDb, 'users', 'owner'), { reputation: 9999 }));
    await assertFails(updateDoc(doc(ownerDb, 'users', 'owner'), { subscriptionTier: 'biz' }));
  });

  it('accepts a one-time rating and rejects overwrites', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();

    await assertSucceeds(updateDoc(doc(buyerDb, 'users', 'owner'), { 'ratings.buyer': 5 }));
    await assertFails(updateDoc(doc(buyerDb, 'users', 'owner'), { 'ratings.buyer': 1 }));
    await assertFails(updateDoc(doc(buyerDb, 'users', 'owner'), { 'ratings.buyer': 9 }));
  });
});

describe('barterItems', () => {
  it('rejects listing creation from signed-out visitors', async () => {
    const anonDb = testEnv.unauthenticatedContext().firestore();
    await assertFails(setDoc(doc(anonDb, 'barterItems', 'new'), newItem()));
  });

  it('accepts a valid listing owned by the signed-in user', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    await assertSucceeds(setDoc(doc(buyerDb, 'barterItems', 'new'), newItem()));
  });

  it('rejects a listing that claims another owner', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    await assertFails(setDoc(doc(buyerDb, 'barterItems', 'new'), newItem({ ownerId: 'owner' })));
  });

  it('lets only the owner edit a listing', async () => {
    const ownerDb = testEnv.authenticatedContext('owner').firestore();
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();

    await assertSucceeds(updateDoc(doc(ownerDb, 'barterItems', 'item1'), { city: 'Johannesburg' }));
    await assertFails(updateDoc(doc(buyerDb, 'barterItems', 'item1'), { city: 'Durban' }));
  });

  it('allows an inquiry to be appended without allowing edits', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    const inquiry = {
      senderId: 'buyer',
      senderName: 'Buyer',
      message: 'Is this still available?',
      createdAt: new Date(),
    };

    await assertSucceeds(
      updateDoc(doc(buyerDb, 'barterItems', 'item1'), { inquiries: arrayUnion(inquiry) }),
    );
    await assertFails(
      updateDoc(doc(buyerDb, 'barterItems', 'item1'), {
        inquiries: [{ ...inquiry, message: 'edited' }],
      }),
    );
  });

  it('allows one vote per non-owner and blocks a second vote', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    const ownerDb = testEnv.authenticatedContext('owner').firestore();

    await assertSucceeds(updateDoc(doc(buyerDb, 'barterItems', 'item1'), { 'votes.buyer': 'up' }));
    await assertFails(updateDoc(doc(buyerDb, 'barterItems', 'item1'), { 'votes.buyer': 'down' }));
    await assertFails(updateDoc(doc(ownerDb, 'barterItems', 'item1'), { 'votes.owner': 'up' }));
  });
});

describe('activeBids', () => {
  it('creates a valid pending bid against an existing listing', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    await assertSucceeds(setDoc(doc(buyerDb, 'activeBids', 'bid1'), newBid()));
  });

  it('rejects a bid whose owner does not match the listing', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    await assertFails(setDoc(doc(buyerDb, 'activeBids', 'bid1'), newBid({ ownerId: 'buyer' })));
  });

  it('lets only the two participants read a bid', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'activeBids', 'bid1'), newBid());
    });

    const ownerDb = testEnv.authenticatedContext('owner').firestore();
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    const outsiderDb = testEnv.authenticatedContext('outsider').firestore();

    await assertSucceeds(getDoc(doc(ownerDb, 'activeBids', 'bid1')));
    await assertSucceeds(getDoc(doc(buyerDb, 'activeBids', 'bid1')));
    await assertFails(getDoc(doc(outsiderDb, 'activeBids', 'bid1')));
  });

  it('allows messages but only the owner may change the status', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'activeBids', 'bid1'), newBid());
    });

    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    const ownerDb = testEnv.authenticatedContext('owner').firestore();

    await assertSucceeds(
      updateDoc(doc(buyerDb, 'activeBids', 'bid1'), {
        messages: arrayUnion({
          senderId: 'buyer',
          senderName: 'Buyer',
          content: 'Can I collect on Saturday?',
          createdAt: new Date(),
        }),
        lastUpdated: new Date(),
      }),
    );

    await assertFails(updateDoc(doc(buyerDb, 'activeBids', 'bid1'), { status: 'Completed' }));
    await assertSucceeds(
      updateDoc(doc(ownerDb, 'activeBids', 'bid1'), {
        status: 'Completed',
        lastUpdated: new Date(),
      }),
    );
  });

  it('lets the bidder withdraw a pending offer only', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'activeBids', 'bid1'), newBid());
    });

    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    await assertSucceeds(deleteDoc(doc(buyerDb, 'activeBids', 'bid1')));
  });

  it('does not let either participant delete closed trade history', async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      await setDoc(doc(context.firestore(), 'activeBids', 'bid1'), {
        ...newBid(),
        status: 'Completed',
      });
    });

    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    const ownerDb = testEnv.authenticatedContext('owner').firestore();
    await assertFails(deleteDoc(doc(buyerDb, 'activeBids', 'bid1')));
    await assertFails(deleteDoc(doc(ownerDb, 'activeBids', 'bid1')));
  });
});

describe('payments', () => {
  it('lets only the owner read a payment', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    const ownerDb = testEnv.authenticatedContext('owner').firestore();
    const outsiderDb = testEnv.authenticatedContext('outsider').firestore();

    await assertSucceeds(getDoc(doc(buyerDb, 'payments', 'pay1')));
    await assertFails(getDoc(doc(ownerDb, 'payments', 'pay1')));
    await assertFails(getDoc(doc(outsiderDb, 'payments', 'pay1')));
  });

  it('never lets a client create, update, or delete a payment', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();

    await assertFails(
      setDoc(doc(buyerDb, 'payments', 'pay2'), {
        ownerId: 'buyer',
        plan: 'basic',
        amountZar: 49,
        status: 'paid',
        createdAt: new Date(),
      }),
    );
    await assertFails(updateDoc(doc(buyerDb, 'payments', 'pay1'), { status: 'paid' }));
    await assertFails(deleteDoc(doc(buyerDb, 'payments', 'pay1')));
  });
});

describe('unrelated collections', () => {
  it('denies writes to collections not covered by the rules', async () => {
    const buyerDb = testEnv.authenticatedContext('buyer').firestore();
    await assertFails(addDoc(collection(buyerDb, 'admin'), { secret: true }));
  });
});
