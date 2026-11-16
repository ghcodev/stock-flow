export function baixarArquivo(blob: Blob, nome: string, documento: Document = document, url: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL): void {
  const endereco = url.createObjectURL(blob);
  const ancora = documento.createElement("a");
  ancora.href = endereco;
  ancora.download = nome;
  ancora.rel = "noopener";
  ancora.style.display = "none";
  documento.body.appendChild(ancora);
  ancora.click();
  ancora.remove();
  window.setTimeout(() => url.revokeObjectURL(endereco), 0);
}
