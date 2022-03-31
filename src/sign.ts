import * as x509 from "@peculiar/x509";
import * as pdfCore from "@peculiarventures/pdf-core";
import * as pdfDoc from "@peculiarventures/pdf-doc";
import { BufferSourceConverter, Convert } from "pvtsutils";
import * as pkijs from "pkijs";
import "./common";

x509.cryptoProvider.set(crypto);
pkijs.setEngine("PDF crypto", crypto, new pdfCore.PDFCryptoEngine({ crypto: crypto, subtle: crypto.subtle }));

const $digestMechanism = document.getElementById("digest_mechanism") as HTMLInputElement;
const $namedCurve = document.getElementById("named_curve") as HTMLInputElement;
const $generate = document.getElementById("generate") as HTMLInputElement;
const $saveFile = document.getElementById("save_file") as HTMLAnchorElement;

async function generateChain(algorithm: EcKeyGenParams & EcdsaParams) {
  //! NOTE Leaf certificate uses extractable key. It's required for case when SHA3 digest is needed
  const leafKeys = await crypto.subtle.generateKey(algorithm, true, ["sign", "verify"]) as Required<CryptoKeyPair>;
  const rootAlg: RsaHashedKeyGenParams = {
    name: "RSASSA-PKCS1-v1_5",
    hash: "SHA-256",
    publicExponent: new Uint8Array([1, 0, 1]),
    modulusLength: 2048,
  };
  const rootKeys = await crypto.subtle.generateKey(rootAlg, false, ["sign", "verify"]) as Required<CryptoKeyPair>;
  const rootCert = await x509.X509CertificateGenerator.createSelfSigned({
    name: "CN=Test Root CA, O=Peculiar Ventures",
    keys: rootKeys,
    notAfter: new Date("01-01-2030"),
    notBefore: new Date("01-01-2022"),
    serialNumber: "010203040506",
    signingAlgorithm: rootAlg,
    extensions: [
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.cRLSign | x509.KeyUsageFlags.keyCertSign),
      await x509.AuthorityKeyIdentifierExtension.create(rootKeys.publicKey, false, crypto),
      await x509.SubjectKeyIdentifierExtension.create(rootKeys.publicKey, false, crypto),
      new x509.BasicConstraintsExtension(true),
    ]
  });
  rootCert.privateKey = rootKeys.privateKey;

  const leafCert = await x509.X509CertificateGenerator.create({
    subject: "CN=Test certificate, O=Peculiar Ventures",
    issuer: rootCert.subject,
    notAfter: new Date(Date.now() + 864 * 1e5),
    notBefore: new Date(),
    serialNumber: Convert.ToHex(crypto.getRandomValues(new Uint8Array(10))),
    signingKey: rootKeys.privateKey,
    publicKey: leafKeys.publicKey,
    signingAlgorithm: rootAlg,
    extensions: [
      new x509.KeyUsagesExtension(x509.KeyUsageFlags.digitalSignature | x509.KeyUsageFlags.nonRepudiation),
      await x509.SubjectKeyIdentifierExtension.create(leafKeys.publicKey, false, crypto),
      await x509.AuthorityKeyIdentifierExtension.create(rootKeys.publicKey, false, crypto),
    ],
  });
  leafCert.privateKey = leafKeys.privateKey;

  return [leafCert, rootCert];
}

function saveFile(data: BufferSource, name: string) {
  const blob = new Blob([BufferSourceConverter.toUint8Array(data)], { type: "octet/stream" });
  const url = window.URL.createObjectURL(blob);
  $saveFile.href = url;
  $saveFile.download = name;
  $saveFile.click();
  window.URL.revokeObjectURL(url);
};

// saveFile([sampleBytes], 'example.txt');

async function main() {
  $generate.addEventListener("click", () => {
    (async () => {
      const hash = $digestMechanism.value;
      const namedCurve = $namedCurve.value;

      let algName = ["Ed25519", "Ed448"].includes(namedCurve)
        ? "EdDSA"
        : "ECDSA";

      const chain = await generateChain({
        name: algName,
        namedCurve,
        hash,
      });

      const doc = await pdfDoc.PDFDocument.create({
        useXrefTable: true,
      });

      const page = doc.pages.create();
      const text = page.text()
        .move("1cm", "1cm")
        .leading(14);

      text.show(`${algName} ${namedCurve} + ${hash}`).nextLine();

      await doc.save();

      await doc.sign({
        containerCreate: async (data: Uint8Array) => {
          const signingCert = chain[0];
          const messageDigest = await crypto.subtle.digest(hash, data);
          const signedData = new pdfDoc.CMSSignedData();
          const signer = signedData.createSigner(signingCert, {
            digestAlgorithm: hash,
            signedAttributes: [
              new pdfDoc.ContentTypeAttribute(pdfDoc.CMSContentType.data),
              // new SigningTimeAttribute(new Date("2021-10-04")),
              new pdfDoc.MessageDigestAttribute(messageDigest),
              await pdfDoc.SigningCertificateV2Attribute.create("SHA-256", signingCert),
            ]
          });

          (signingCert.privateKey!.algorithm as any).hash = { name: hash };

          await signedData.sign(signingCert.privateKey!, signer);

          // Add signing certificate to CMS
          signedData.certificates.push(signingCert);
          signedData.certificates.push(chain[1]);

          return signedData.toBER();
        },
        containerSize: 2048,
        dictionaryUpdate: async (field) => {
        },
      });

      const pdf = await doc.save();
      saveFile(pdf, `${chain[0].privateKey!.algorithm.name} ${(chain[0].privateKey!.algorithm as any).namedCurve} + ${hash}.pdf`);
    })().catch(e => console.error(e));
  });
}

main().catch(e => console.error(e));