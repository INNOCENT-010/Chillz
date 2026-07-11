export function QRDisplay({ value }: { value: string }) {
  const size = 200; const cells = 21; const cellSize = size / cells;
  const grid: boolean[][] = [];
  let seed = 0;
  for (let i = 0; i < value.length; i++) seed = (seed * 31 + value.charCodeAt(i)) & 0xffffffff;
  const rand = () => { seed = (seed * 1664525 + 1013904223) & 0xffffffff; return (seed >>> 0) / 0x100000000; };
  for (let r = 0; r < cells; r++) {
    grid[r] = [];
    for (let c = 0; c < cells; c++) {
      const inFinder = (r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8);
      if (inFinder) {
        const lr = r % 8; const lc = c % 8;
        const rr = r >= cells - 8 ? r - (cells - 8) : r;
        const rc = c >= cells - 8 ? c - (cells - 8) : c;
        const border = lr===0||lr===6||lc===0||lc===6||rr===0||rr===6||rc===0||rc===6;
        const innerDot = (lr>=2&&lr<=4&&lc>=2&&lc<=4)||(rr>=2&&rr<=4&&rc>=2&&rc<=4);
        grid[r][c] = border || innerDot;
      } else { grid[r][c] = rand() > 0.5; }
    }
  }
  return (
    <div style={{ padding: 12, backgroundColor: "#FFFFFF", borderRadius: 16, display: "inline-block", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
      <svg width={size} height={size} xmlns="http://www.w3.org/2000/svg">
        {grid.map((row, r) => row.map((filled, c) => filled
          ? <rect key={`${r}-${c}`} x={c*cellSize} y={r*cellSize} width={cellSize} height={cellSize} fill="#0A0A0A" />
          : null))}
      </svg>
    </div>
  );
}