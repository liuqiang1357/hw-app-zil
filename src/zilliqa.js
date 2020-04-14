import { splitPath } from './utils';

const CLA = 0xe0;
const INS = {
    "getVersion": 0x01,
    "getPublickKey": 0x02,
    "getPublicAddress": 0x02,
    "signTxn": 0x04,
    "signHash": 0x08
};

const PubKeyByteLen = 33;
const SigByteLen = 64;
const HashByteLen = 32;
// https://github.com/Zilliqa/Zilliqa/wiki/Address-Standard#specification
const Bech32AddrLen = "zil".length + 1 + 32 + 6;

/**
 * Zilliqa API
 *
 * @example
 * import Zil from "@ledgerhq/hw-app-zil";
 * const zil = new Zil(transport)
 */
export default class Zilliqa {

    constructor(transport, scrambleKey = "w0w") {
        this.transport = transport;
        transport.decorateAppAPIMethods(
            this,
            [
                "getVersion",
                "getPublicKey",
                "getPublicAddress",
                "signHash",
                "signTxn"
            ],
            scrambleKey
        );
    }

    getVersion() {
        const P1 = 0x00;
        const P2 = 0x00;

        return this.transport
            .send(CLA, INS.getVersion, P1, P2)
            .then(response => {
                let version = "v";
                for (let i = 0; i < 3; ++i) {
                    version += parseInt("0x" + response[i]);
                    if (i !== 2) {
                        version += "."
                    }
                }
                return {version};
            });
    }

    getPublicKey(path) {
        const P1 = 0x00;
        const P2 = 0x00;

        let payload = Buffer.alloc(4);
        payload.writeInt32LE(this.getKeyIndex(path));

        return this.transport
            .send(CLA, INS.getPublickKey, P1, P2, payload)
            .then(response => {
                // The first PubKeyByteLen bytes are the public address.
                const publicKey = response.toString("hex").slice(0, (PubKeyByteLen * 2));
                return publicKey;
            });
    }

    getPublicAddress(path) {
        const P1 = 0x00;
        const P2 = 0x01;

        let payload = Buffer.alloc(4);
        payload.writeInt32LE(this.getKeyIndex(path));

        return this.transport
            .send(CLA, INS.getPublicAddress, P1, P2, payload)
            .then(response => {
                // After the first PubKeyByteLen bytes, the remaining is the bech32 address string.
                const pubAddr = response.slice(PubKeyByteLen, PubKeyByteLen + Bech32AddrLen).toString("utf-8");
                return pubAddr;
            }).catch(error => {
                if (error.statusCode === 26368) {
                    throw Error('Please check if Zilliqa App is open on Ledger.')
                }
                throw Error(error.message);
            });
    }

    signTransaction(path, txnBytes) {
        // https://github.com/Zilliqa/Zilliqa-JavaScript-Library/tree/dev/packages/zilliqa-js-account#interfaces
        const P1 = 0x00;
        const P2 = 0x00;

        let indexBytes = Buffer.alloc(4);
        indexBytes.writeInt32LE(this.getKeyIndex(path));

        const STREAM_LEN = 200; // Stream in batches of STREAM_LEN bytes each.
        var txn1Bytes;
        if (txnBytes.length > STREAM_LEN) {
            txn1Bytes = txnBytes.slice(0, STREAM_LEN);
            txnBytes = txnBytes.slice(STREAM_LEN, undefined);
        } else {
            txn1Bytes = txnBytes;
            txnBytes = Buffer.alloc(0);
        }

        var txn1SizeBytes = Buffer.alloc(4);
        txn1SizeBytes.writeInt32LE(txn1Bytes.length);
        var hostBytesLeftBytes = Buffer.alloc(4);
        hostBytesLeftBytes.writeInt32LE(txnBytes.length);
        // See signTxn.c:handleSignTxn() for sequence details of payload.
        // 1. 4 bytes for indexBytes.
        // 2. 4 bytes for hostBytesLeftBytes.
        // 3. 4 bytes for txn1SizeBytes (number of bytes being sent now).
        // 4. txn1Bytes of actual data.
        const payload = Buffer.concat([indexBytes, hostBytesLeftBytes, txn1SizeBytes, txn1Bytes]);


        let transport = this.transport;
        return transport
            .send(CLA, INS.signTxn, P1, P2, payload)
            .then(function cb(response) {
                // Keep streaming data into the device till we run out of it.
                // See signTxn.c:istream_callback() for how this is used.
                // Each time the bytes sent consists of:
                //  1. 4-bytes of hostBytesLeftBytes.
                //  2. 4-bytes of txnNSizeBytes (number of bytes being sent now).
                //  3. txnNBytes of actual data.
                if (txnBytes.length > 0) {
                    var txnNBytes;
                    if (txnBytes.length > STREAM_LEN) {
                        txnNBytes = txnBytes.slice(0, STREAM_LEN);
                        txnBytes = txnBytes.slice(STREAM_LEN, undefined);
                    } else {
                        txnNBytes = txnBytes;
                        txnBytes = Buffer.alloc(0);
                    }

                    var txnNSizeBytes = Buffer.alloc(4);
                    txnNSizeBytes.writeInt32LE(txnNBytes.length);
                    hostBytesLeftBytes.writeInt32LE(txnBytes.length);
                    const payload = Buffer.concat([hostBytesLeftBytes, txnNSizeBytes, txnNBytes]);
                    // Except for the payload, all others are ignored in the device.
                    // Only for the first send above will those paramters matter.
                    return transport.send(CLA, INS.signTxn, P2, P2, payload).then(cb);
                }
                return response;
            })
            .then(result => {
                return {signature: result.slice(0, SigByteLen)};
            });

    }

    signHash(path, hashBytes) {
        const P1 = 0x00;
        const P2 = 0x00;

        let indexBytes = Buffer.alloc(4);
        indexBytes.writeInt32LE(this.getKeyIndex(path));

        let hashLen = hashBytes.length;
        if (hashLen <= 0) {
            throw Error(`Hash length ${hashLen} is invalid`);
        }
        if (hashLen > HashByteLen) {
            hashBytes.slice(0, HashByteLen);
        }
        const payload = Buffer.concat([indexBytes, hashBytes]);

        return this.transport
            .send(CLA, INS.signHash, P1, P2, payload)
            .then(result => {
                return {signature: result.slice(0, SigByteLen)}
            });
    }

    getKeyIndex(path) {
        const paths = splitPath(path);
        if (paths.length !== 5) {
            throw Error(`Only path have 5 parts is supported`);
        }
        return paths[4];
    }
}
