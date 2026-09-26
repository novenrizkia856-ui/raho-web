export interface SignatureScheme {
  id: string;
  name: string;
  type: "classical" | "post_quantum";
  description: string;
}

/** Display choices only. A deployed adapter will supply supported schemes. */
export const signatureSchemes: SignatureScheme[] = [
  { id: "ecdsa", name: "ECDSA", type: "classical", description: "Current account authentication" },
  { id: "pq-a", name: "Post Quantum Scheme A", type: "post_quantum", description: "Demo scheme option" },
  { id: "pq-b", name: "Post Quantum Scheme B", type: "post_quantum", description: "Demo scheme option" },
];
export const postQuantumSchemes = signatureSchemes.filter((scheme) => scheme.type === "post_quantum");
export const schemeName = (id: string): string => signatureSchemes.find((scheme) => scheme.id === id)?.name ?? id;
