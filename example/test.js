import Transport from '@ledgerhq/hw-transport-node-hid';
import App from '@ont-dev/hw-app-zil';

async function test() {
  const path = "44'/313'/0'/0/0";
  const hash = '7bc067238eab7ce5873a33b7e35f25681099f687caf6db86ad596a28d8e7c451';

  const transport = await Transport.create();
  const app = new App(transport);

  const publicKey = await app.getPublicKey(path);
  console.log(publicKey);

  const address = await app.getAddress(path);
  console.log(address);

  const signature = await app.signHash(path, hash);
  console.log(signature);
}

test();
