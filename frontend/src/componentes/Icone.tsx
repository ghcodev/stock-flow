export function Icone({ nome, className }: { nome: string; className?: string }) {
  return (
    <svg className={className ? `icone ${className}` : "icone"} aria-hidden="true" focusable="false">
      <use href={`/icones.svg#i-${nome}`} />
    </svg>
  );
}
