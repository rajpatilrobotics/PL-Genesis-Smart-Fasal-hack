import { LitNodeClient } from "@lit-protocol/lit-node-client";
import { LitAbility, LIT_NETWORK } from "@lit-protocol/constants";
import {
  LitAccessControlConditionResource,
  createSiweMessageWithRecaps,
  generateAuthSig,
} from "@lit-protocol/auth-helpers";
import { ethers } from "ethers";

const EPHEMERAL_KEY = "sf_lit_ephem_pk";
const SESSION_KEY = "sf_lit_session";

export function getEphemeralWallet(): ethers.Wallet {
  let pk = localStorage.getItem(EPHEMERAL_KEY);
  if (!pk) {
    const w = ethers.Wallet.createRandom();
    pk = w.privateKey;
    localStorage.setItem(EPHEMERAL_KEY, pk);
  }
  return new ethers.Wallet(pk);
}

let _client: LitNodeClient | null = null;

export async function getLitClient(): Promise<LitNodeClient> {
  if (_client && (_client as any).ready) return _client;
  _client = new LitNodeClient({
    litNetwork: LIT_NETWORK.DatilDev,
    debug: false,
  });
  await _client.connect();
  return _client;
}

export function makeLitACC(walletAddress: string) {
  return [
    {
      contractAddress: "",
      standardContractType: "",
      chain: "ethereum",
      method: "eth_getBalance",
      parameters: [walletAddress, "latest"],
      returnValueTest: { comparator: ">=", value: "0" },
    },
  ];
}

export type LitEncryptResult = {
  ciphertext: string;
  dataToEncryptHash: string;
  walletAddress: string;
  network: string;
  nodeCount: number;
};

export async function litEncrypt(plaintext: string): Promise<LitEncryptResult> {
  const client = await getLitClient();
  const wallet = getEphemeralWallet();
  const acc = makeLitACC(wallet.address);

  const { ciphertext, dataToEncryptHash } = await client.encrypt({
    accessControlConditions: acc,
    dataToEncrypt: new TextEncoder().encode(plaintext),
  });

  return {
    ciphertext,
    dataToEncryptHash,
    walletAddress: wallet.address,
    network: LIT_NETWORK.DatilDev,
    nodeCount: 7,
  };
}

async function getSessionSigs(client: LitNodeClient, wallet: ethers.Wallet, acc: object[]) {
  const cached = sessionStorage.getItem(SESSION_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (parsed.expiry && Date.now() < parsed.expiry) return parsed.sigs;
    } catch {}
  }

  const expiration = new Date(Date.now() + 1000 * 60 * 60).toISOString();
  const sigs = await client.getSessionSigs({
    chain: "ethereum",
    expiration,
    resourceAbilityRequests: [
      {
        resource: new LitAccessControlConditionResource("*"),
        ability: LitAbility.AccessControlConditionDecryption,
      },
    ],
    authNeededCallback: async ({ uri, expiration: exp, resourceAbilityRequests }) => {
      const toSign = await createSiweMessageWithRecaps({
        uri: uri!,
        expiration: exp!,
        resources: resourceAbilityRequests,
        walletAddress: wallet.address,
        nonce: await client.getLatestBlockhash(),
        litNodeClient: client,
      });
      return generateAuthSig({ signer: wallet as unknown as Parameters<typeof generateAuthSig>[0]["signer"], toSign });
    },
  });

  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ sigs, expiry: Date.now() + 1000 * 55 * 60 }));
  return sigs;
}

export async function litDecrypt(
  ciphertext: string,
  dataToEncryptHash: string,
  walletAddress: string
): Promise<string> {
  const client = await getLitClient();
  const wallet = getEphemeralWallet();

  if (wallet.address.toLowerCase() !== walletAddress.toLowerCase()) {
    throw new Error("Wallet mismatch: content was encrypted for a different address.");
  }

  const acc = makeLitACC(walletAddress);
  const sessionSigs = await getSessionSigs(client, wallet, acc);

  const { decryptedData } = await client.decrypt({
    chain: "ethereum",
    ciphertext,
    dataToEncryptHash,
    accessControlConditions: acc,
    sessionSigs,
  });

  return new TextDecoder().decode(decryptedData);
}

export function shortCipher(c: string) {
  return c.substring(0, 12) + "..." + c.substring(c.length - 8);
}
