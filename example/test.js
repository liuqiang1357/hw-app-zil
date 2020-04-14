import Transport from '@ledgerhq/hw-transport-node-hid';
import App from '@ont-dev/hw-app-zil';

async function test() {
  const transport = Transport.create();
  const app = new App(transport);

  const publicKey = await app.getPublicKey("44'/313'/0'/0/0")
  console.log(publicKey);

  const address = await app.getPublicAddress("44'/313'/0'/0/0");
  console.log(address);

  const hash = '7bc067238eab7ce5873a33b7e35f25681099f687caf6db86ad596a28d8e7c451';
  const signature = (await app.signHash("44'/313'/0'/0/0", Buffer.from(hash, 'hex'))).toString('hex');
  console.log(signature);
}

test();
