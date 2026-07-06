export function FormBadges({ form }: { form: string }) {
  const color = (c: string) =>
    c === 'W' ? 'var(--win)' : c === 'L' ? 'var(--loss)' : 'var(--draw)'
  const label = (c: string) => (c === 'W' ? 'S' : c === 'L' ? 'T' : 'J')
  return (
    <span className="inline-flex gap-1">
      {form.split('').map((c, i) => (
        <span
          key={i}
          className="w-5 h-5 rounded text-[10px] font-bold text-white flex items-center justify-center"
          style={{ background: color(c), opacity: 1 - i * 0.12 }}
          title={i === 0 ? 'Nýjasti leikur' : undefined}
        >
          {label(c)}
        </span>
      ))}
    </span>
  )
}
