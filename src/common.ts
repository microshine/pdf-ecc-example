import * as pdfDoc from "@peculiarventures/pdf-doc";
import { AsnConvert } from "@peculiar/asn1-schema";
import { AlgorithmIdentifier } from "@peculiar/asn1-x509";
import { HashedAlgorithm } from "@peculiarventures/pdf-doc";

const id_SHAKE128 = "2.16.840.1.101.3.4.2.11";
const id_SHAKE256 = "2.16.840.1.101.3.4.2.12";
const id_SHA3_256 = "2.16.840.1.101.3.4.2.8";
const id_SHA3_384 = "2.16.840.1.101.3.4.2.9";
const id_SHA3_512 = "2.16.840.1.101.3.4.2.10";
const name_SHAKE128 = "SHAKE128";
const name_SHAKE256 = "SHAKE256";
const name_SHA3_256 = "SHA3-256";
const name_SHA3_384 = "SHA3-384";
const name_SHA3_512 = "SHA3-512";
const id_ECDSA_with_SHA3_256 = "2.16.840.1.101.3.4.3.10";
const id_ECDSA_with_SHA3_384 = "2.16.840.1.101.3.4.3.11";
const id_ECDSA_with_SHA3_512 = "2.16.840.1.101.3.4.3.12";

function registerSha3Algorithm(oid: string, algName: string) {
  return pdfDoc.AlgorithmFactory.register({
    name: algName,
    fromBER: (raw: ArrayBuffer) => {
      try {
        const algId = AsnConvert.parse(raw, AlgorithmIdentifier);
        if (algId.algorithm === oid) {
          return {
            name: algName,
          };
        }
      } catch {
        // nothing
      }
      return null;
    },
    toBER: (algorithm: Algorithm) => {
      if (algorithm.name === algName) {
        const algId = new AlgorithmIdentifier({
          algorithm: oid,
        });

        return AsnConvert.serialize(algId);
      }

      return null;
    },
  });
}

function registerEcdsaSha3Algorithm(oid: string, hashAlgName: string) {
  return pdfDoc.AlgorithmFactory.register({
    name: `ECDSA+${hashAlgName}`,
    fromBER: (raw: ArrayBuffer) => {
      try {
        const algId = AsnConvert.parse(raw, AlgorithmIdentifier);
        if (algId.algorithm === oid) {
          return {
            name: "ECDSA",
            hash: {
              name: hashAlgName
            }
          };
        }
      } catch {
        // nothing
      }
      return null;
    },
    toBER: (algorithm: Algorithm | HashedAlgorithm) => {
      if ("hash" in algorithm && algorithm.hash.name === hashAlgName) {
        const algId = new AlgorithmIdentifier({
          algorithm: oid,
        });

        return AsnConvert.serialize(algId);
      }

      return null;
    },
  });
}

registerSha3Algorithm(id_SHAKE128, name_SHAKE128);
registerSha3Algorithm(id_SHAKE256, name_SHAKE256);
registerSha3Algorithm(id_SHA3_256, name_SHA3_256);
registerSha3Algorithm(id_SHA3_384, name_SHA3_384);
registerSha3Algorithm(id_SHA3_512, name_SHA3_512);

registerEcdsaSha3Algorithm(id_ECDSA_with_SHA3_256, name_SHA3_256);
registerEcdsaSha3Algorithm(id_ECDSA_with_SHA3_384, name_SHA3_384);
registerEcdsaSha3Algorithm(id_ECDSA_with_SHA3_512, name_SHA3_512);
