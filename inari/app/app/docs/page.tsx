import { Card, CardBody } from "@/components/ui/Card";

export default function DocsPage() {
  return (
    <div className="flex flex-col gap-8">
      <header>
        <div className="font-mono text-xs uppercase tracking-widest text-accent">Docs</div>
        <h1 className="mt-3 font-serif text-4xl tracking-tight">Contract overview.</h1>
      </header>

      <Card>
        <CardBody className="flex flex-col gap-3 text-sm leading-7 text-foreground/80">
          <p>
            Inari runs as a single Uniswap v4 hook plus a custody contract on
            X Layer mainnet. Both contracts source live at
            <code className="ml-1 font-mono">inari/contracts/src/</code>.
          </p>
          <p className="font-mono text-xs text-foreground/60">Hook permissions: 0x0640</p>
          <ul className="ml-5 list-disc">
            <li><code className="font-mono">afterAddLiquidity</code> — records LP into the vault</li>
            <li><code className="font-mono">beforeRemoveLiquidity</code> — gates by unlocked % + lock-extended window</li>
            <li><code className="font-mono">afterSwap</code> — updates TVL / volume / users / crash flag</li>
          </ul>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-2 text-sm leading-7 text-foreground/80">
          <div className="font-mono text-[11px] uppercase tracking-widest text-foreground/60">Coming soon</div>
          <p>Full ABI explorer, transaction history, deployment artifacts.</p>
        </CardBody>
      </Card>
    </div>
  );
}
