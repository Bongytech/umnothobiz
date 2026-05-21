// test-security.js - ES Module version
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runTests() {
  console.log("\n🚀 Starting Security Rules Tests...\n");

  const rulesPath = resolve(__dirname, 'firestore.rules');
  const rules = fs.readFileSync(rulesPath, 'utf8');

  const testEnv = await initializeTestEnvironment({
    projectId: "demo-umnotho",
    firestore: {
      rules: rules,
      host: "localhost",
      port: 8080
    }
  });

  await testEnv.clearFirestore();

  // TEST 1: Owner can edit their own item
  console.log("📝 Test 1: Owner editing their own item");
  const ownerDb = testEnv.authenticatedContext("owner123").firestore();
  await ownerDb.collection("barterItems").doc("item1").set({
    name: "Test Item",
    owner: "owner123",
    description: "Original"
  });
  
  try {
    await assertSucceeds(ownerDb.collection("barterItems").doc("item1").update({ description: "Updated" }));
    console.log("   ✅ PASSED: Owner can update their own item\n");
  } catch (e) {
    console.log("   ❌ FAILED: Owner couldn't update\n");
    console.log("      Error:", e.message, "\n");
  }

  // TEST 2: Hacker cannot edit someone else's item
  console.log("🔒 Test 2: Hacker editing someone else's item");
  const hackerDb = testEnv.authenticatedContext("hacker456").firestore();
  
  try {
    await assertFails(hackerDb.collection("barterItems").doc("item1").update({ description: "Hacked" }));
    console.log("   ✅ PASSED: Hacker blocked from editing\n");
  } catch (e) {
    console.log("   ❌ FAILED: Hacker edited someone else's item!\n");
    console.log("      Error:", e.message, "\n");
  }

  // TEST 3: Hacker cannot delete someone else's item
  console.log("🗑️ Test 3: Hacker deleting someone else's item");
  
  try {
    await assertFails(hackerDb.collection("barterItems").doc("item1").delete());
    console.log("   ✅ PASSED: Hacker blocked from deleting\n");
  } catch (e) {
    console.log("   ❌ FAILED: Hacker deleted someone else's item!\n");
    console.log("      Error:", e.message, "\n");
  }

  // TEST 4: Unauthenticated user cannot create items
  console.log("🚫 Test 4: Unauthenticated user creating item");
  const unAuthDb = testEnv.unauthenticatedContext().firestore();
  
  try {
    await assertFails(unAuthDb.collection("barterItems").doc("item2").set({ name: "Stolen", owner: "hacker" }));
    console.log("   ✅ PASSED: Unauthenticated user blocked\n");
  } catch (e) {
    console.log("   ❌ FAILED: Unauthenticated user created item!\n");
    console.log("      Error:", e.message, "\n");
  }

  // TEST 5: Owner can read their own bid
  console.log("📋 Test 5: Owner reading their bid");
  const bidDb = testEnv.authenticatedContext("owner123").firestore();
  await bidDb.collection("activeBids").doc("bid1").set({
    bidderId: "bidder789",
    ownerId: "owner123",
    status: "pending",
    messages: []
  });
  
  try {
    const bidDoc = await assertSucceeds(bidDb.collection("activeBids").doc("bid1").get());
    if (bidDoc.exists) {
      console.log("   ✅ PASSED: Owner can read their bid\n");
    } else {
      console.log("   ❌ FAILED: Bid not found\n");
    }
  } catch (e) {
    console.log("   ❌ FAILED: Owner couldn't read their bid\n");
    console.log("      Error:", e.message, "\n");
  }

  // TEST 6: Hacker cannot read someone else's bid
  console.log("🔒 Test 6: Hacker reading someone else's bid");
  
  try {
    await assertFails(hackerDb.collection("activeBids").doc("bid1").get());
    console.log("   ✅ PASSED: Hacker cannot read others' bids\n");
  } catch (e) {
    console.log("   ❌ FAILED: Hacker read someone else's bid!\n");
    console.log("      Error:", e.message, "\n");
  }

  await testEnv.cleanup();
  console.log("🏁 Tests complete!\n");
}

runTests().catch(console.error);