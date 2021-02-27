/* eslint-disable max-len, arrow-body-style, no-restricted-syntax */
import { assert } from 'chai';
import sinon from 'sinon';
import { TYPE, SWAP_TYPE } from '../../utils/constants';
import { dbHelper, postgres, db } from '../helpers';

const sandbox = sinon.createSandbox();

describe('Database', () => {
  beforeEach(async () => {
    // Clear out any data in the db
    await postgres.none('TRUNCATE client_accounts, accounts_loki, accounts_bnb, swaps CASCADE;');
  });

  afterEach(() => {
    // Clear any fakes
    sandbox.restore();
  });

  describe('Client Account', () => {
    describe('#getClientAccountForUuid', () => {
      it('should return null if no client account exists', async () => {
        const { count } = await postgres.one('select count(*) from client_accounts');
        assert.equal(count, 0);

        const account = await db.getClientAccountForUuid('123');
        assert.isNull(account);
      });

      context('Beldex Account', () => {
        it('should return null if the account associated with the client account does not exist', async () => {
          const uuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
          await dbHelper.insertClientAccount(uuid, 'address', TYPE.BNB, 'aeb29bf6-97b1-11e9-bc42-526af7764f64', TYPE.BDX);

          const dbClient = await postgres.oneOrNone('select * from client_accounts where uuid = $1;', [uuid]);
          assert.isNotNull(dbClient);

          const client = await db.getClientAccountForUuid(uuid);
          assert.isNull(client);
        });

        it('should return the correct client account if it exists', async () => {
          const uuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
          const address = 'an address';
          const addressType = TYPE.BNB;
          const accountType = TYPE.BDX;
          const accountUuid = 'aeb29bf6-97b1-11e9-bc42-526af7764f64';
          const account = {
            address: 'account address',
            addressIndex: 1,
          };

          await dbHelper.insertBeldexAccount(accountUuid, account.address, account.addressIndex);
          await dbHelper.insertClientAccount(uuid, address, addressType, accountUuid, accountType);

          const client = await db.getClientAccountForUuid(uuid);
          assert.isNotNull(client);

          assert.deepEqual(client, {
            uuid,
            address,
            addressType,
            accountType,
            account,
          });
        });
      });

      context('BNB Account', () => {
        it('should return null if the account associated with the client account does not exist', async () => {
          const uuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
          await dbHelper.insertClientAccount(uuid, 'address', TYPE.BDX, 'aeb29bf6-97b1-11e9-bc42-526af7764f64', TYPE.BNB);

          const dbClient = await postgres.oneOrNone('select * from client_accounts where uuid = $1;', [uuid]);
          assert.isNotNull(dbClient);

          const client = await db.getClientAccountForUuid(uuid);
          assert.isNull(client);
        });

        it('should return the correct client account if it exists', async () => {
          const uuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
          const address = 'an address';
          const addressType = TYPE.BDX;
          const accountType = TYPE.BNB;
          const accountUuid = 'aeb29bf6-97b1-11e9-bc42-526af7764f64';
          const account = { memo: 'memo' };

          await dbHelper.insertBNBAccount(accountUuid, account.memo);
          await dbHelper.insertClientAccount(uuid, address, addressType, accountUuid, accountType);

          const client = await db.getClientAccountForUuid(uuid);
          assert.isNotNull(client);

          assert.deepEqual(client, {
            uuid,
            address,
            addressType,
            accountType,
            account,
          });
        });
      });
    });

    describe('#getClientAccounts', () => {
      it('should return nothing if no client accounts of the given type exist', async () => {
        const { count } = await postgres.one('select count(*) from client_accounts');
        assert.equal(count, 0);

        const results = await db.getClientAccounts(TYPE.BNB);
        assert.isEmpty(results);
      });

      it('should return nothing if the account attached to the client account does not exist', async () => {
        // Insert a client account with a `BDX` account type.
        await dbHelper.insertClientAccount('07a90576-9dfa-11e9-a2a3-2a2ae2dbcce4', '1', TYPE.BNB, 'abcd', TYPE.BDX);
        const results = await db.getClientAccounts(TYPE.BDX);
        assert.isEmpty(results);
      });

      it('should return all the accounts of the given type', async () => {
        const uuids = [
          '07a90576-9dfa-11e9-a2a3-2a2ae2dbcce4',
          '07a908be-9dfa-11e9-a2a3-2a2ae2dbcce4',
          '07a90a26-9dfa-11e9-a2a3-2a2ae2dbcce4',
          '07a90e4a-9dfa-11e9-a2a3-2a2ae2dbcce4',
          '07a90f94-9dfa-11e9-a2a3-2a2ae2dbcce4',
        ];
        await postgres.tx(t => t.batch([
          dbHelper.insertBNBAccount('bnb', 'memo'),
          dbHelper.insertBeldexAccount('bdx', 'bdxAddress', 1),
          dbHelper.insertClientAccount(uuids[0], '1', TYPE.BNB, 'bdx', TYPE.BDX),
          dbHelper.insertClientAccount(uuids[1], '1', TYPE.BNB, 'bdx', TYPE.BDX),
          dbHelper.insertClientAccount(uuids[2], '1', TYPE.BNB, 'bdx', TYPE.BDX),
          dbHelper.insertClientAccount(uuids[3], '1', TYPE.BDX, 'bnb', TYPE.BNB),
          dbHelper.insertClientAccount(uuids[4], '1', TYPE.BDX, 'bnb', TYPE.BNB),
        ]));

        const { count } = await postgres.one('select count(*) from client_accounts');
        assert.equal(count, 5);

        const beldexAccounts = await db.getClientAccounts(TYPE.BDX);
        assert.lengthOf(beldexAccounts, 3);

        const bnbAccounts = await db.getClientAccounts(TYPE.BNB);
        assert.lengthOf(bnbAccounts, 2);
      });

      context('BDX Accounts', () => {
        it('should return the accounts in the correct format', async () => {
          const uuid = '07a90576-9dfa-11e9-a2a3-2a2ae2dbcce4';
          const address = '1';
          const addressType = TYPE.BNB;
          const accountType = TYPE.BDX;

          await postgres.tx(t => t.batch([
            dbHelper.insertBNBAccount('bnb', 'memo'),
            dbHelper.insertBeldexAccount('bdx', 'bdxAddress', 1),
            dbHelper.insertClientAccount(uuid, address, addressType, 'bdx', accountType),
          ]));

          const accounts = await db.getClientAccounts(TYPE.BDX);
          assert.lengthOf(accounts, 1);

          const account = accounts[0];
          assert.deepEqual(account, {
            uuid,
            address,
            addressType,
            accountType,
            account: {
              address: 'bdxAddress',
              addressIndex: 1,
            },
          });
        });
      });

      context('BNB Accounts', () => {
        it('should return the accounts in the correct format', async () => {
          const uuid = '07a90576-9dfa-11e9-a2a3-2a2ae2dbcce4';
          const address = '1';
          const addressType = TYPE.BDX;
          const accountType = TYPE.BNB;

          await postgres.tx(t => t.batch([
            dbHelper.insertBNBAccount('bnb', 'memo'),
            dbHelper.insertClientAccount(uuid, address, addressType, 'bnb', accountType),
          ]));

          const accounts = await db.getClientAccounts(TYPE.BNB);
          assert.lengthOf(accounts, 1);

          const account = accounts[0];
          assert.deepEqual(account, {
            uuid,
            address,
            addressType,
            accountType,
            account: { memo: 'memo' },
          });
        });
      });
    });

    describe('#getClientAccount', () => {
      it('should return null if no client account with the address and addressType exists', async () => {
        const { count } = await postgres.one('select count(*) from client_accounts');
        assert.equal(count, 0);

        const account = await db.getClientAccount('123', TYPE.BDX);
        assert.isNull(account);
      });

      context('Beldex Account', () => {
        it('should return null if the account attached to the client account does not exist', async () => {
          // Insert a client account with a `BDX` account type.
          await dbHelper.insertClientAccount('07a90576-9dfa-11e9-a2a3-2a2ae2dbcce4', '123', TYPE.BNB, 'abcd', TYPE.BDX);
          const account = await db.getClientAccount('123', TYPE.BNB);
          assert.isNull(account);
        });

        it('should return the correct values', async () => {
          const uuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
          const beldexAddress = '123';
          const bnbAddress = '345';

          await dbHelper.insertBeldexAccount('bdx', beldexAddress, 0);
          await dbHelper.insertClientAccount(uuid, bnbAddress, TYPE.BNB, 'bdx', TYPE.BDX);

          const account = await db.getClientAccount(bnbAddress, TYPE.BNB);
          assert.isNotNull(account);
          assert.deepEqual(account, {
            uuid,
            address: bnbAddress,
            addressType: TYPE.BNB,
            accountType: TYPE.BDX,
            account: {
              address: beldexAddress,
              addressIndex: 0,
            },
          });
        });
      });

      context('BNB Account', () => {
        it('should return null if the account attached to the client account does not exist', async () => {
          // Insert a client account with a `BDX` account type.
          await dbHelper.insertClientAccount('07a90576-9dfa-11e9-a2a3-2a2ae2dbcce4', '123', TYPE.BDX, 'abcd', TYPE.BNB);
          const account = await db.getClientAccount('123', TYPE.BDX);
          assert.isNull(account);
        });

        it('should return the correct values', async () => {
          const uuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
          const bnbAddress = '345';

          await dbHelper.insertBNBAccount('bnb', 'memo');
          await dbHelper.insertClientAccount(uuid, bnbAddress, TYPE.BDX, 'bnb', TYPE.BNB);

          const account = await db.getClientAccount(bnbAddress, TYPE.BDX);
          assert.isNotNull(account);
          assert.deepEqual(account, {
            uuid,
            address: bnbAddress,
            addressType: TYPE.BDX,
            accountType: TYPE.BNB,
            account: { memo: 'memo' },
          });
        });
      });
    });

    describe('#insertClientAccount', () => {
      it('should return null if an invalid account was passed', async () => {
        const insertBeldexSpy = sandbox.spy(db, 'insertBeldexAccount');
        const insertBNBSpy = sandbox.spy(db, 'insertBNBAccount');

        const result = await db.insertClientAccount('123', TYPE.BDX, null);
        assert.isNull(result);
        assert(insertBNBSpy.called, 'insertBNBAccount was not called');

        const another = await db.insertClientAccount('123', TYPE.BNB, null);
        assert.isNull(another);
        assert(insertBeldexSpy.called, 'insertBeldexAccount was not called');
      });

      it('should insert a BDX account if address type is BNB', async () => {
        const beldexAddress = 'BDX-address';
        await db.insertClientAccount('123', TYPE.BNB, { address: beldexAddress, address_index: 0 });

        const accounts = await postgres.manyOrNone('select * from accounts_loki');
        assert.isNotNull(accounts);
        assert.lengthOf(accounts, 1);

        assert.strictEqual(accounts[0].address, beldexAddress);
        assert.equal(accounts[0].address_index, 0);
      });

      it('should insert a BNB account if address type is BDX', async () => {
        const memo = 'bnbMemo';
        await db.insertClientAccount('123', TYPE.BDX, { memo });

        const accounts = await postgres.manyOrNone('select * from accounts_bnb');
        assert.isNotNull(accounts);
        assert.lengthOf(accounts, 1);
        assert.strictEqual(accounts[0].memo, memo);
      });
    });
  });

  describe('Beldex', () => {
    describe('#insertBeldexAccount', () => {
      it('should return null if account is not set', async () => {
        const account = await db.insertBeldexAccount(null);
        assert.isNull(account);
      });

      it('should insert the bdx account we specified and return it', async () => {
        const address = 'abcd';
        const addressIndex = 0;

        const account = await db.insertBeldexAccount({ address, address_index: addressIndex });
        assert.isNotNull(account);
        assert.strictEqual(account.address, address);
        assert.strictEqual(account.address_index, addressIndex);

        const { count } = await postgres.one('select count(*) from accounts_loki');
        assert.equal(count, 1);
      });
    });

    describe('#getBeldexAccount', () => {
      it('should return null if it could not find and account', async () => {
        const { count } = await postgres.one('select count(*) from accounts_loki');
        assert.equal(count, 0);

        const account = await db.getBeldexAccount('fake address');
        assert.isNull(account);
      });

      it('should return the account successfully if it exists', async () => {
        const uuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
        const address = 'abcdef';
        const index = 0;
        await dbHelper.insertBeldexAccount(uuid, address, index);

        const account = await db.getBeldexAccount(address);
        assert.isNotNull(account);
        assert.strictEqual(account.uuid, uuid);
        assert.strictEqual(account.address, address);
        assert.strictEqual(account.address_index, index);
      });
    });
  });

  describe('BNB', () => {
    describe('#insertBNBAccount', () => {
      it('should return null if account is not set', async () => {
        const account = await db.insertBNBAccount(null);
        assert.isNull(account);
      });

      it('should return null if memo', async () => {
        const account = await db.insertBNBAccount({});
        assert.isNull(account);

        const valid = await db.insertBNBAccount({ memo: '123' });
        assert.isNotNull(valid);
      });

      it('should return the uuid and memo if it exists', async () => {
        const memo = '123';
        const account = await db.insertBNBAccount({ memo });
        assert.isNotNull(account);
        assert.strictEqual(account.memo, memo);
        assert.deepEqual(Object.keys(account), ['uuid', 'memo']);
      });
    });
  });

  describe('Swap', () => {
    describe('#getSwapsForClientAccount', () => {
      it('should return an empty array if no swaps were found', async () => {
        const { count } = await postgres.one('select count(*) from swaps');
        assert.equal(count, 0);

        const swaps = await db.getSwapsForClientAccount('abcd');
        assert.isEmpty(swaps);
      });

      it('should return all the swaps for the given client account', async () => {
        const clientUuid = 'clientUuid';
        await postgres.tx(t => t.batch([
          dbHelper.insertSwap('1', SWAP_TYPE.BDX_TO_BBDX, 1, clientUuid),
          dbHelper.insertSwap('2', SWAP_TYPE.BBDX_TO_BDX, 2, clientUuid),
          dbHelper.insertSwap('3', SWAP_TYPE.BDX_TO_BBDX, 4, 'another uuid'),
        ]));

        const swaps = await db.getSwapsForClientAccount(clientUuid);
        assert.lengthOf(swaps, 2);
      });
    });

    describe('#getPendingSwaps', () => {
      it('should return an empty array if no swaps were found', async () => {
        const { count } = await postgres.one('select count(*) from swaps');
        assert.equal(count, 0);

        const swaps = await db.getPendingSwaps(SWAP_TYPE.BDX_TO_BBDX);
        assert.isEmpty(swaps);
      });

      it('should return all the swaps that are pending', async () => {
        const clientUuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
        await postgres.tx(t => t.batch([
          dbHelper.insertSwap('1', SWAP_TYPE.BDX_TO_BBDX, 1, clientUuid, 'pending swap'),
          dbHelper.insertSwap('2', SWAP_TYPE.BDX_TO_BBDX, 1, clientUuid, 'completed swap', 'transaction', Date.now()),
          dbHelper.insertSwap('3', SWAP_TYPE.BBDX_TO_BDX, 1, clientUuid, 'pending swap'),
        ]));

        const swaps = await db.getPendingSwaps(SWAP_TYPE.BDX_TO_BBDX);
        assert.lengthOf(swaps, 1);
      });

      it('should return the correct data', async () => {
        const clientUuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
        const address = 'abc';
        const accountUuid = 'aeb29bf6-97b1-11e9-bc42-526af7764f64';
        const depositHash = '1234';

        await postgres.tx(t => t.batch([
          dbHelper.insertClientAccount(clientUuid, address, TYPE.BDX, accountUuid, TYPE.BNB),
          dbHelper.insertSwap('1', SWAP_TYPE.BDX_TO_BBDX, 2, clientUuid, 'pending swap'),
          dbHelper.insertSwap('2', SWAP_TYPE.BDX_TO_BBDX, 9, clientUuid, 'completed swap', 'transaction', Date.now()),
          dbHelper.insertSwap('3', SWAP_TYPE.BBDX_TO_BDX, 10, clientUuid, depositHash),
        ]));

        const swaps = await db.getPendingSwaps(SWAP_TYPE.BBDX_TO_BDX);
        assert.lengthOf(swaps, 1);

        const swap = swaps[0];
        assert.strictEqual(swap.type, SWAP_TYPE.BBDX_TO_BDX);
        assert.equal(swap.amount, 10);
        assert.strictEqual(swap.deposit_transaction_hash, depositHash);
        assert.strictEqual(swap.address_type, TYPE.BDX);
        assert.strictEqual(swap.address, address);
        assert.strictEqual(swap.account_type, TYPE.BNB);
        assert.strictEqual(swap.account_uuid, accountUuid);
      });
    });

    describe('#insertSwap', () => {
      it('should return null if a null transaction was passed', async () => {
        const swap = await db.insertSwap(null, { uuid: '1', addressType: TYPE.BDX });
        assert.isNull(swap);
      });

      it('should return null if a null clientAccount was passed', async () => {
        const swap = await db.insertSwap({ hash: '1', amount: 2 }, null);
        assert.isNull(swap);
      });

      it('should insert the swap correctly', async () => {
        const clientUuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
        const swap = await db.insertSwap({ hash: '123', amount: 10, timestamp: 3 }, { uuid: clientUuid, addressType: TYPE.BDX });
        assert.isNotNull(swap);

        const dbSwap = await postgres.oneOrNone('select * from swaps where uuid = $1', [swap.uuid]);
        assert.isNotNull(dbSwap);
        assert.strictEqual(dbSwap.uuid, swap.uuid);
        assert.strictEqual(dbSwap.type, SWAP_TYPE.BBDX_TO_BDX);
        assert.equal(dbSwap.amount, 10);
        assert.strictEqual(dbSwap.deposit_transaction_hash, '123');
        assert.strictEqual(dbSwap.client_account_uuid, clientUuid);
        assert.equal(Date.parse(dbSwap.deposit_transaction_created), 19803000);
      });
    });

    describe('#insertSwaps', () => {
      const clientAccount = { uuid: '1', addressType: TYPE.BDX, address: '123', accountAddress: '234' };
      const transactions = [1, 2, 3].map(t => ({ hash: String(t), amount: t }));

      it('should return an empty array if a null client account was passed', async () => {
        const swaps = await db.insertSwaps([{ hash: '123', amount: 1 }], null);
        assert.isEmpty(swaps);
      });

      it('should return an empty array if null or empty transactions were passed', async () => {
        const swaps = await db.insertSwaps(null, clientAccount);
        assert.isEmpty(swaps);

        const otherSwaps = await db.insertSwaps([], clientAccount);
        assert.isEmpty(otherSwaps);
      });

      it('should insert all the passed transactions', async () => {
        const swaps = await db.insertSwaps(transactions, clientAccount);
        assert.lengthOf(swaps, 3);

        const { count } = await postgres.one('select count(*) from swaps');
        assert.equal(count, 3);
      });

      it('should only insert valid transactions', async () => {
        const swaps = await db.insertSwaps([...transactions, null, null], clientAccount);
        assert.lengthOf(swaps, 3);

        const { count } = await postgres.one('select count(*) from swaps');
        assert.equal(count, 3);
      });

      it('should return the correct data', async () => {
        const transaction = { hash: 'hash123', amount: 100 };
        const swaps = await db.insertSwaps([transaction], clientAccount);
        assert.lengthOf(swaps, 1);

        const swap = swaps[0];
        assert.strictEqual(swap.type, SWAP_TYPE.BBDX_TO_BDX);
        assert.equal(swap.amount, transaction.amount);
        assert.strictEqual(swap.deposit_transaction_hash, transaction.hash);
      });
    });

    describe('#updateSwapsTransferTransactionHash', () => {
      it('should update transaction hash and set swap to processed', async () => {
        const uuid = '17b42f9e-97b1-11e9-bc42-526af7764f64';
        const transferTxHash = 'transfer';
        await dbHelper.insertSwap(uuid, SWAP_TYPE.BDX_TO_BBDX, 10, 'uuid', 'deposit');

        const { count: processedCount } = await postgres.one('select count(*) from swaps where processed is not null');
        assert.equal(processedCount, 0);

        await db.updateSwapsTransferTransactionHash([uuid], transferTxHash);
        const { count: newProcessedCount } = await postgres.one('select count(*) from swaps where processed is not null');
        assert.equal(newProcessedCount, 1);

        // eslint-disable-next-line camelcase
        const { transfer_transaction_hash } = await postgres.one('select transfer_transaction_hash from swaps where uuid = $1', [uuid]);
        assert.strictEqual(transfer_transaction_hash, transferTxHash);
      });
    });
  });
});
