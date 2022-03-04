import * as x509 from "@peculiar/x509";
import * as pdfCore from "@peculiarventures/pdf-core";
import * as pdfDoc from "@peculiarventures/pdf-doc";
import * as pkijs from "pkijs";

x509.cryptoProvider.set(crypto);
pkijs.setEngine("PDF crypto", crypto, new pdfCore.PDFCryptoEngine({ crypto: crypto, subtle: crypto.subtle }));

const $pdfFile = document.getElementById("pdf_file") as HTMLInputElement;
const $verify = document.getElementById("verify") as HTMLInputElement;
const $report = document.getElementById("report") as HTMLElement;

$verify.addEventListener("click", () => {
  (async () => {
    if ($pdfFile.files && $pdfFile.files[0]) {
      const reader = new FileReader();
      const file = await new Promise<ArrayBuffer>((resolve, reject) => {
        reader.readAsArrayBuffer($pdfFile.files![0]);
        reader.onerror = (e) => {
          reject(reader.error);
        };
        reader.onload = (e) => {
          resolve(reader.result as ArrayBuffer);
        };
      });
      await verify(file);
    } else {
      alert("PDF file is not selected");
    }
  })().catch(e => console.error(e));
});

class RootCertificateStorageHandler extends pdfDoc.DefaultCertificateStorageHandler {

  public override async isTrusted(cert: x509.X509Certificate): Promise<pdfDoc.IsTrustedResult> {
    return {
      target: this,
      result: await cert.isSelfSigned(),
    };
  }
}

function clear() {
  $report.innerHTML = "";
}

function group(name: string) {
  const tr = document.createElement("tr");
  tr.classList.add("group");
  const td = document.createElement("td");
  td.setAttribute("colspan", "2");
  td.textContent = name;

  tr.append(td);
  $report.append(tr);
}

function print(label: string, value: string) {
  const tr = document.createElement("tr");
  const tdLabel = document.createElement("td");
  tdLabel.textContent = label;
  const tdValue = document.createElement("td");
  tdValue.textContent = value;

  tr.append(tdLabel);
  tr.append(tdValue);

  $report.append(tr);
}

async function verify(file: BufferSource) {
  const doc = await pdfDoc.PDFDocument.load(file);
  doc.certificateHandler.parent = new RootCertificateStorageHandler();

  const res = await doc.verify();
  console.log(res);

  // report
  clear();
  if (res.err) {
    print("error", res.err.message);
  } if (!res.items.length) {
    print("info", "Signature not found");
  } else {
    const sig = res.items[0];

    group("Common");
    print("Check date:", sig.checkDate?.toString() || "none");
    if (sig.location) {
      print("Location:", sig.location);
    }
    if (sig.reason) {
      print("Reason:", sig.reason);
    }

    print("Signature type:", sig.signatureType);

    if (sig.signerCertificate) {
      print("Signer:", sig.signerCertificate.subject);
      print("Issuer:", sig.signerCertificate.issuer);
    }

    if (sig.signedData) {
      const signer = sig.signedData.signers[0];
      group("Algorithms");
      print("Digest mechanism:", signer.digestAlgorithm.name);
      print("Signature mechanism:", signer.signatureAlgorithm.name);
      if (sig.signerCertificate) {
        if ("namedCurve" in sig.signerCertificate.publicKey.algorithm) {
          print("Named curve:", (sig.signerCertificate.publicKey.algorithm as any).namedCurve);
        }
      }
    }

    group("States")
    for (const state of sig.states) {
      print(state.code, state.data.resultMessage
        ? `${state.text}. ${state.data.resultMessage}`
        : state.text );
    }
  }
}