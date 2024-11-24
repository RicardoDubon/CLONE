import { v4 as uuidv4 } from "uuid";
import mysql from "mysql2/promise";
import readline from "readline";

const askQuestion = (query) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(query, (ans) => {
      rl.close();
      resolve(ans);
    })
  );
};

async function cloneStore() {
  const originalStoreId = await askQuestion("Enter the original Store ID: ");
  const newStoreUuid = uuidv4();
  console.log(`New Store UUID: ${newStoreUuid}`);

  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "123456",
    database: "sigfa",
  });

  const sellIdMap = {}; // Para almacenar la relación entre idSell original y clonado

  try {
    // Clonar la tienda
    await connection.execute(`
      INSERT INTO store (
        idStore, Name, Alias, Nit, Telefono1, Telefono2, 
        Whatsapp, Email, Web, Aniversary, CountryCode, CountryName, 
        StateCode, StateName, City, Address, Stock, Frequency, CantOpen, 
        Missing, Excess, EnabledProducts, IdCompany, CreatedBy, CreatedAt, 
        ModifiedBy, ModifiedAt, MonthlyAverage, Attempts
      )
      SELECT 
        ?, Name, Alias, Nit, Telefono1, Telefono2, 
        Whatsapp, Email, Web, Aniversary, CountryCode, CountryName, 
        StateCode, StateName, City, Address, Stock, Frequency, CantOpen, 
        Missing, Excess, EnabledProducts, IdCompany, CreatedBy, CreatedAt, 
        ModifiedBy, ModifiedAt, MonthlyAverage, Attempts
      FROM store
      WHERE idStore = ?
    `, [newStoreUuid, originalStoreId]);

    console.log(
      `Store cloned successfully from ${originalStoreId} to ${newStoreUuid}`
    );

    // Clonar las ventas
    const [sells] = await connection.execute(`
      SELECT idSell FROM sell WHERE idStore = ?
    `, [originalStoreId]);

    for (const sell of sells) {
      const newSellUuid = uuidv4();
      sellIdMap[sell.idSell] = newSellUuid;

      await connection.execute(`
        INSERT INTO sell (
          idSell, Number, ClientName, PaymentType, SellType, Advance, 
          Document, Observation, Status, Total, idStore, IdCompany, 
          idCompanyBank, idUser, idClient, CreatedAt, CreatedBy, 
          ModifiedBy, ModifiedAt
        )
        SELECT 
          ?, Number, ClientName, PaymentType, SellType, Advance, 
          Document, Observation, Status, Total, ?, IdCompany, 
          idCompanyBank, idUser, idClient, CreatedAt, CreatedBy, 
          ModifiedBy, ModifiedAt
        FROM sell
        WHERE idSell = ?
      `, [newSellUuid, newStoreUuid, sell.idSell]);
    }

    console.log("Sales cloned successfully.");

    // Clonar los productos de las ventas (sellproducto)
    for (const [originalSellId, clonedSellId] of Object.entries(sellIdMap)) {
      const [sellProducts] = await connection.execute(`
        SELECT * FROM sellproducto WHERE idSell = ?
      `, [originalSellId]);

      for (const sellProduct of sellProducts) {
        const newSellProductUuid = uuidv4();

        await connection.execute(`
          INSERT INTO sellproducto (
            idSellProducto, Cant, Discount, Price, SubTotal, 
            idProduct, idSell, idLote
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newSellProductUuid,
          sellProduct.Cant,
          sellProduct.Discount,
          sellProduct.Price,
          sellProduct.SubTotal,
          sellProduct.idProduct,
          clonedSellId,
          sellProduct.idLote
        ]);
      }
    }

    console.log("Sell products cloned successfully.");

    // Clonar las compras
    const buyIdMap = {}; // Para almacenar la relación entre idBuy original y clonado
    const [buys] = await connection.execute(`
      SELECT idBuy FROM buy WHERE idStore = ?
    `, [originalStoreId]);

    for (const buy of buys) {
      const newBuyUuid = uuidv4();
      buyIdMap[buy.idBuy] = newBuyUuid;

      await connection.execute(`
        INSERT INTO buy (
          idBuy, Number, DocumentType, DocumentNumber, DocumentSerie, Total, 
          PaymentType, Cost, CostDistribution, \`Return\`, PaymentOrigin, 
          ShipOrigin, Mount, Description, Observation, Status, IsResolved, 
          CommentaryResolved, idStore, idProvider, idCompanyBank, IdCompany, 
          CreatedAt, CreatedBy, ModifiedAt, ModifiedBy, DateEntry, OrderDate
        )
        SELECT 
          ?, Number, DocumentType, DocumentNumber, DocumentSerie, Total, 
          PaymentType, Cost, CostDistribution, \`Return\`, PaymentOrigin, 
          ShipOrigin, Mount, Description, Observation, Status, IsResolved, 
          CommentaryResolved, ?, idProvider, idCompanyBank, IdCompany, 
          CreatedAt, CreatedBy, ModifiedAt, ModifiedBy, DateEntry, OrderDate
        FROM buy
        WHERE idBuy = ?
      `, [newBuyUuid, newStoreUuid, buy.idBuy]);
    }

    console.log("Purchases cloned successfully.");

    // Clonar los productos de las compras (buyproduct)
    for (const [originalBuyId, clonedBuyId] of Object.entries(buyIdMap)) {
      const [buyProducts] = await connection.execute(`
        SELECT * FROM buyproduct WHERE idBuy = ?
      `, [originalBuyId]);

      for (const buyProduct of buyProducts) {
        const newBuyProductUuid = uuidv4();

        await connection.execute(`
          INSERT INTO buyproduct (
            idBuyProduct, CostUnit, Discount, Cost, SubTotal, ShipCost, 
            Cant, TempCant, idBuy, idProduct, CreatedAt, CreatedBy
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          newBuyProductUuid,
          buyProduct.CostUnit,
          buyProduct.Discount,
          buyProduct.Cost,
          buyProduct.SubTotal,
          buyProduct.ShipCost,
          buyProduct.Cant,
          buyProduct.TempCant,
          clonedBuyId,
          buyProduct.idProduct,
          buyProduct.CreatedAt,
          buyProduct.CreatedBy
        ]);
      }
    }

    console.log("Purchase products cloned successfully.");
  } catch (error) {
    console.error("Error:", error.message);
  } finally {
    await connection.end();
  }
}

cloneStore();
