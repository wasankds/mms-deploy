
/* 

การสร้าง index ด้วย db.collection.createIndex({key:1})
ควรทำ "ครั้งเดียว" ต่อ collection (ไม่ต้องทำซ้ำทุกครั้งที่ query)
โดยปกติจะทำในขั้นตอน setup database หรือ maintenance

*/

import 'dotenv/config'
import { MongoClient } from 'mongodb'
const dbUrl = 'mongodb://localhost:27017'
const dbName = process.env.DB_NAME

const client = new MongoClient(dbUrl);
async function myDbStart() {
  try {
    await client.connect();
    const db = client.db(dbName);

    //=== จับcollection ที่ขึ้นต้นด้วย e ตามด้วยตัวเลข 3 ตัว
    const colls = await db.listCollections().toArray()
    const filteredColls = colls
                          .map(coll => coll.name)
                          .filter(name => /^e\d{3}$/.test(name));
    //=== วนลูปสร้าง index บนฟิลด์ "key"
    for (const collName of filteredColls) { 
      const collection = db.collection(collName);      
      const result = await collection.createIndex({ key: 1 });
      console.log(`สร้าง Index สำหรับ collection '${collName}':`, result);
    }

  } catch (error) {
    console.error('Error deleting fields:', error)
  } finally {
    await client.close();
  }
}

myDbStart()