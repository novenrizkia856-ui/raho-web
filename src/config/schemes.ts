export interface SignatureScheme {
  /** keccak256 of the label, as used onchain. */
  id: `0x${string}`;
  label: string;
  name: string;
  type: "classical" | "post_quantum";
  description: string;
}

/** Schemes the app knows how to name. The registry decides which are enabled. */
export const signatureSchemes: SignatureScheme[] = [
  {
    id: "0xdd257d51d34f3ce6230fa6c519bdb92e87d983673f990241740ea874c53296c7",
    label: "ECDSA",
    name: "ECDSA",
    type: "classical",
    description: "Owner wallet signature, the account's starting authentication",
  },
  {
    id: "0x4d0d5661c3562569a5481d9d8b698fa449bff9fbcfb1bb035addf5d7a95c83aa",
    label: "LAMPORT-KECCAK256",
    name: "Lamport (keccak256)",
    type: "post_quantum",
    description: "Hash based one time signatures, a new key for every action",
  },
];
export const postQuantumSchemes = signatureSchemes.filter((scheme) => scheme.type === "post_quantum");
export const schemeName = (id: string): string =>
  signatureSchemes.find((scheme) => scheme.id.toLowerCase() === id.toLowerCase())?.name ?? `${id.slice(0, 10)}…`;
