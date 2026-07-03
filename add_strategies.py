import sys

with open('frontend/src/App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update loadStrategySetup with Zebra and Synthetic Futures
old_logic = """    else if (n.includes('ratio backspread')) {
      // generic fallback - assume call
      const sellK = atm;
      const buyK  = atm + step;
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: sellK, premium: ceBid(sellK), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: buyK,  premium: ceAsk(buyK),  quantity: 2 }
      ];
    }
    else if (n.includes('calendar spread') || n.includes('time spread')) {
      // Can only show current expiry; use far OTM as placeholder for far leg
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: atm, premium: ceBid(atm), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: atm, premium: ceAsk(atm) * 1.4, quantity: 1 }
      ];
    }"""

new_logic = """    else if (n.includes('ratio backspread')) {
      // generic fallback - assume call
      const sellK = atm;
      const buyK  = atm + step;
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: sellK, premium: ceBid(sellK), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: buyK,  premium: ceAsk(buyK),  quantity: 2 }
      ];
    }
    else if (n.includes('long zebra') || (n.includes('zebra') && !n.includes('short'))) {
      const buyK = atm - (2 * step); // ITM Call
      const sellK = atm; // ATM Call
      newLegs = [
        { id: id(), type: 'call', action: 'buy',  strike: buyK,  premium: ceAsk(buyK),  quantity: 2 },
        { id: id(), type: 'call', action: 'sell', strike: sellK, premium: ceBid(sellK), quantity: 1 }
      ];
    }
    else if (n.includes('short zebra')) {
      const buyK = atm + (2 * step); // ITM Put
      const sellK = atm; // ATM Put
      newLegs = [
        { id: id(), type: 'put', action: 'buy',  strike: buyK,  premium: peAsk(buyK),  quantity: 2 },
        { id: id(), type: 'put', action: 'sell', strike: sellK, premium: peBid(sellK), quantity: 1 }
      ];
    }
    else if (n.includes('long synthetic future') || (n.includes('synthetic future') && !n.includes('short'))) {
      newLegs = [
        { id: id(), type: 'call', action: 'buy',  strike: atm, premium: ceAsk(atm), quantity: 1 },
        { id: id(), type: 'put',  action: 'sell', strike: atm, premium: peBid(atm), quantity: 1 }
      ];
    }
    else if (n.includes('short synthetic future')) {
      newLegs = [
        { id: id(), type: 'put',  action: 'buy',  strike: atm, premium: peAsk(atm), quantity: 1 },
        { id: id(), type: 'call', action: 'sell', strike: atm, premium: ceBid(atm), quantity: 1 }
      ];
    }
    else if (n.includes('calendar spread') || n.includes('time spread')) {
      // Calendar spreads require multiple expirations. 
      // The builder currently evaluates a single expiration. 
      // This is a placeholder showing the structure using the same expiry for demonstration.
      newLegs = [
        { id: id(), type: 'call', action: 'sell', strike: atm, premium: ceBid(atm), quantity: 1 },
        { id: id(), type: 'call', action: 'buy',  strike: atm, premium: ceAsk(atm) * 1.4, quantity: 1 }
      ];
    }"""

if old_logic not in content:
    print("Error: Could not find old_logic")
    sys.exit(1)

content = content.replace(old_logic, new_logic)


# 2. Update the buttons in the UI
old_buttons = """            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Covered Call', rank: 1 } as any)}>Covered Call</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Bull Call Debit Spread', rank: 1 } as any)}>Bull Call Spread</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Bull Put Credit Spread', rank: 1 } as any)}>Bull Put Spread</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Iron Condor', rank: 1 } as any)}>Iron Condor</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Short Straddle', rank: 1 } as any)}>Short Straddle</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Call Ratio Backspread', rank: 1 } as any)}>Ratio Backspread</button>
            </div>"""

new_buttons = """            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Covered Call', rank: 1 } as any)}>Covered Call</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Bull Call Debit Spread', rank: 1 } as any)}>Bull Call Spread</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Bull Put Credit Spread', rank: 1 } as any)}>Bull Put Spread</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Iron Condor', rank: 1 } as any)}>Iron Condor</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Short Straddle', rank: 1 } as any)}>Short Straddle</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Call Ratio Backspread', rank: 1 } as any)}>Ratio Backspread</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Long Zebra', rank: 1 } as any)}>Long Z.E.B.R.A</button>
              <button className="outline" onClick={() => loadStrategySetup({ name: 'Long Synthetic Future', rank: 1 } as any)}>Synthetic Future</button>
            </div>"""

if old_buttons not in content:
    print("Error: Could not find old_buttons")
    sys.exit(1)

content = content.replace(old_buttons, new_buttons)

with open('frontend/src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated App.tsx with Zebra and Synthetic Futures")
