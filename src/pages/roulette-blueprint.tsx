// Demo page to test the new roulette board blueprint
import React, { useState } from 'react';
import { RouletteBoardBlueprint } from '../components/roulette-blueprint';
import type { BetPayload } from '../components/roulette-blueprint';

const RouletteBlueprintDemo: React.FC = () => {
    const [selectedBets, setSelectedBets] = useState<{ id: string; payload: BetPayload }[]>([]);

    const handleBetSelected = (betId: string, payload: BetPayload) => {
        setSelectedBets(prev => [...prev.slice(-9), { id: betId, payload }]); // Keep last 10
    };

    return (
        <div style={{
            minHeight: '100vh',
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
            padding: '20px',
            fontFamily: 'sans-serif',
        }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
                <h1 style={{
                    color: '#fff',
                    textAlign: 'center',
                    marginBottom: '20px',
                    fontSize: '2rem',
                }}>
                    🎰 Roulette Board Blueprint
                </h1>

                <p style={{ color: '#888', textAlign: 'center', marginBottom: '30px' }}>
                    SVG-based roulette board with precise hitboxes. Toggle debug mode to see all betting areas.
                </p>

                {/* The Blueprint Component */}
                <RouletteBoardBlueprint
                    onBetSelected={handleBetSelected}
                />

                {/* Recent Bets Log */}
                <div style={{
                    marginTop: '30px',
                    padding: '20px',
                    background: '#0a0a0a',
                    borderRadius: '8px',
                    border: '1px solid #333',
                }}>
                    <h3 style={{ color: '#00ff00', marginBottom: '10px' }}>Recent Bets (click any area)</h3>
                    {selectedBets.length === 0 ? (
                        <p style={{ color: '#666' }}>No bets selected yet. Click on the board!</p>
                    ) : (
                        <div style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            maxHeight: '200px',
                            overflowY: 'auto',
                        }}>
                            {selectedBets.map((bet, i) => (
                                <div
                                    key={i}
                                    style={{
                                        padding: '8px 12px',
                                        background: '#1a1a1a',
                                        borderRadius: '4px',
                                        color: '#fff',
                                        fontFamily: 'monospace',
                                        fontSize: '12px',
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                    }}
                                >
                                    <span style={{ color: '#00ff00' }}>{bet.id}</span>
                                    <span style={{ color: '#888' }}>{bet.payload.label}</span>
                                    <span style={{ color: '#ffd700' }}>{bet.payload.payout}:1</span>
                                    <span style={{ color: '#666', fontSize: '10px' }}>
                                        [{bet.payload.numbers.join(', ')}]
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div style={{
                    marginTop: '20px',
                    padding: '20px',
                    background: '#0a0a0a',
                    borderRadius: '8px',
                    border: '1px solid #333',
                    color: '#fff',
                }}>
                    <h3 style={{ color: '#ffd700', marginBottom: '10px' }}>Bet Types & Payouts</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><strong>Straight-up:</strong> Single number (35:1)</div>
                        <div><strong>Split:</strong> 2 adjacent numbers (17:1)</div>
                        <div><strong>Street:</strong> Row of 3 (11:1)</div>
                        <div><strong>Corner:</strong> 4 numbers (8:1)</div>
                        <div><strong>Six-line:</strong> 6 numbers (5:1)</div>
                        <div><strong>Dozen:</strong> 12 numbers (2:1)</div>
                        <div><strong>Column:</strong> 12 numbers (2:1)</div>
                        <div><strong>Even-money:</strong> 18 numbers (1:1)</div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RouletteBlueprintDemo;
