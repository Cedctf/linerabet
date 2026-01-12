import React from 'react';

interface HotspotButtonProps {
    name: string;
    left: string;
    top: string;
    width: string;
    height: string;
    onClick?: (name: string) => void;
    debug?: boolean;
}

const HotspotButtonBase: React.FC<HotspotButtonProps> = ({ name, left, top, width, height, onClick, debug }) => {
    const [isHovered, setIsHovered] = React.useState(false);

    return (
        <button
            data-id={name}
            onClick={() => {
                console.log(`Clicked: ${name}`);
                onClick?.(name);
            }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            style={{
                position: 'absolute',
                left,
                top,
                width,
                height,
                padding: 0,
                border: debug ? '1px solid lime' : 'none',
                cursor: 'pointer',
                zIndex: 1000,
                backgroundColor: isHovered
                    ? (debug ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255, 255, 255, 0.2)')
                    : (debug ? 'rgba(0, 255, 255, 0.2)' : 'transparent'),
                boxShadow: isHovered ? '0 0 15px 5px rgba(255, 255, 255, 0.6)' : 'none',
                transition: 'all 0.2s ease',
                outline: 'none',
                borderRadius: '2px',
            }}
            title={name}
        />
    );
};

// --- STREET TOP MARKERS (Alternating Yellow/Cyan) ---
// Yellow = 3.0% wide rectangles, Cyan = 1.5% dots
export const StreetTopYellow1 = (props: any) => <HotspotButtonBase name="streetTopYellow1" left="12.03%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan1 = (props: any) => <HotspotButtonBase name="streetTopCyan1" left="16.3%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow2 = (props: any) => <HotspotButtonBase name="streetTopYellow2" left="19.03%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan2 = (props: any) => <HotspotButtonBase name="streetTopCyan2" left="23%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow3 = (props: any) => <HotspotButtonBase name="streetTopYellow3" left="26.8%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan3 = (props: any) => <HotspotButtonBase name="streetTopCyan3" left="30.05%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow4 = (props: any) => <HotspotButtonBase name="streetTopYellow4" left="33.3%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan4 = (props: any) => <HotspotButtonBase name="streetTopCyan4" left="36.55%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow5 = (props: any) => <HotspotButtonBase name="streetTopYellow5" left="39.8%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan5 = (props: any) => <HotspotButtonBase name="streetTopCyan5" left="43.05%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow6 = (props: any) => <HotspotButtonBase name="streetTopYellow6" left="46.3%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan6 = (props: any) => <HotspotButtonBase name="streetTopCyan6" left="49.55%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow7 = (props: any) => <HotspotButtonBase name="streetTopYellow7" left="52.8%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan7 = (props: any) => <HotspotButtonBase name="streetTopCyan7" left="56.05%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow8 = (props: any) => <HotspotButtonBase name="streetTopYellow8" left="59.3%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan8 = (props: any) => <HotspotButtonBase name="streetTopCyan8" left="62.55%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow9 = (props: any) => <HotspotButtonBase name="streetTopYellow9" left="65.8%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan9 = (props: any) => <HotspotButtonBase name="streetTopCyan9" left="69.05%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow10 = (props: any) => <HotspotButtonBase name="streetTopYellow10" left="72.3%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan10 = (props: any) => <HotspotButtonBase name="streetTopCyan10" left="75.55%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow11 = (props: any) => <HotspotButtonBase name="streetTopYellow11" left="78.8%" top="4.2%" width="3.0%" height="2.0%" {...props} />;
export const StreetTopCyan11 = (props: any) => <HotspotButtonBase name="streetTopCyan11" left="82.05%" top="4.2%" width="1.5%" height="1.5%" {...props} />;
export const StreetTopYellow12 = (props: any) => <HotspotButtonBase name="streetTopYellow12" left="85.3%" top="4.2%" width="3.0%" height="2.0%" {...props} />;

// --- STREET BOTTOM MARKERS (Alternating Yellow/Cyan) ---
// Yellow = 3.0% wide rectangles, Cyan = 1.5% dots
export const StreetBottomYellow1 = (props: any) => <HotspotButtonBase name="streetBottomYellow1" left="12.3%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan1 = (props: any) => <HotspotButtonBase name="streetBottomCyan1" left="16.03%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow2 = (props: any) => <HotspotButtonBase name="streetBottomYellow2" left="19.03%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan2 = (props: any) => <HotspotButtonBase name="streetBottomCyan2" left="23.55%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow3 = (props: any) => <HotspotButtonBase name="streetBottomYellow3" left="26.8%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan3 = (props: any) => <HotspotButtonBase name="streetBottomCyan3" left="30.05%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow4 = (props: any) => <HotspotButtonBase name="streetBottomYellow4" left="33.3%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan4 = (props: any) => <HotspotButtonBase name="streetBottomCyan4" left="36.55%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow5 = (props: any) => <HotspotButtonBase name="streetBottomYellow5" left="39.8%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan5 = (props: any) => <HotspotButtonBase name="streetBottomCyan5" left="43.05%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow6 = (props: any) => <HotspotButtonBase name="streetBottomYellow6" left="46.3%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan6 = (props: any) => <HotspotButtonBase name="streetBottomCyan6" left="49.55%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow7 = (props: any) => <HotspotButtonBase name="streetBottomYellow7" left="52.8%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan7 = (props: any) => <HotspotButtonBase name="streetBottomCyan7" left="56.05%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow8 = (props: any) => <HotspotButtonBase name="streetBottomYellow8" left="59.3%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan8 = (props: any) => <HotspotButtonBase name="streetBottomCyan8" left="62.55%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow9 = (props: any) => <HotspotButtonBase name="streetBottomYellow9" left="65.8%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan9 = (props: any) => <HotspotButtonBase name="streetBottomCyan9" left="69.05%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow10 = (props: any) => <HotspotButtonBase name="streetBottomYellow10" left="72.3%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan10 = (props: any) => <HotspotButtonBase name="streetBottomCyan10" left="75.55%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow11 = (props: any) => <HotspotButtonBase name="streetBottomYellow11" left="78.8%" top="61.5%" width="3.0%" height="2.0%" {...props} />;
export const StreetBottomCyan11 = (props: any) => <HotspotButtonBase name="streetBottomCyan11" left="82.05%" top="61.5%" width="1.5%" height="1.5%" {...props} />;
export const StreetBottomYellow12 = (props: any) => <HotspotButtonBase name="streetBottomYellow12" left="85.3%" top="61.5%" width="3.0%" height="2.0%" {...props} />;

// --- DASHES (Horizontal splits between rows) ---
export const DashHorizR1C1 = (props: any) => <HotspotButtonBase name="dashHorizR1C1" left="14.0%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C2 = (props: any) => <HotspotButtonBase name="dashHorizR1C2" left="20.5%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C3 = (props: any) => <HotspotButtonBase name="dashHorizR1C3" left="27.0%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C4 = (props: any) => <HotspotButtonBase name="dashHorizR1C4" left="33.5%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C5 = (props: any) => <HotspotButtonBase name="dashHorizR1C5" left="40.0%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C6 = (props: any) => <HotspotButtonBase name="dashHorizR1C6" left="46.5%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C7 = (props: any) => <HotspotButtonBase name="dashHorizR1C7" left="53.0%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C8 = (props: any) => <HotspotButtonBase name="dashHorizR1C8" left="59.5%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C9 = (props: any) => <HotspotButtonBase name="dashHorizR1C9" left="66.0%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C10 = (props: any) => <HotspotButtonBase name="dashHorizR1C10" left="72.5%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C11 = (props: any) => <HotspotButtonBase name="dashHorizR1C11" left="79.0%" top="22.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR1C12 = (props: any) => <HotspotButtonBase name="dashHorizR1C12" left="85.5%" top="22.5%" width="3.5%" height="1.5%" {...props} />;

export const DashHorizR2C1 = (props: any) => <HotspotButtonBase name="dashHorizR2C1" left="14.0%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C2 = (props: any) => <HotspotButtonBase name="dashHorizR2C2" left="20.5%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C3 = (props: any) => <HotspotButtonBase name="dashHorizR2C3" left="27.0%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C4 = (props: any) => <HotspotButtonBase name="dashHorizR2C4" left="33.5%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C5 = (props: any) => <HotspotButtonBase name="dashHorizR2C5" left="40.0%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C6 = (props: any) => <HotspotButtonBase name="dashHorizR2C6" left="46.5%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C7 = (props: any) => <HotspotButtonBase name="dashHorizR2C7" left="53.0%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C8 = (props: any) => <HotspotButtonBase name="dashHorizR2C8" left="59.5%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C9 = (props: any) => <HotspotButtonBase name="dashHorizR2C9" left="66.0%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C10 = (props: any) => <HotspotButtonBase name="dashHorizR2C10" left="72.5%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C11 = (props: any) => <HotspotButtonBase name="dashHorizR2C11" left="79.0%" top="39.5%" width="3.5%" height="1.5%" {...props} />;
export const DashHorizR2C12 = (props: any) => <HotspotButtonBase name="dashHorizR2C12" left="85.5%" top="39.5%" width="3.5%" height="1.5%" {...props} />;

// --- DASHES (Vertical splits between columns) ---
export const DashVertR1C0 = (props: any) => <HotspotButtonBase name="dashVertR1C0" left="10.8%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C0 = (props: any) => <HotspotButtonBase name="dashVertR2C0" left="10.8%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C0 = (props: any) => <HotspotButtonBase name="dashVertR3C0" left="10.8%" top="43.5%" width="1.0%" height="9.0%" {...props} />;

export const DashVertR1C1 = (props: any) => <HotspotButtonBase name="dashVertR1C1" left="17.3%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C2 = (props: any) => <HotspotButtonBase name="dashVertR1C2" left="23.8%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C3 = (props: any) => <HotspotButtonBase name="dashVertR1C3" left="30.3%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C4 = (props: any) => <HotspotButtonBase name="dashVertR1C4" left="36.8%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C5 = (props: any) => <HotspotButtonBase name="dashVertR1C5" left="43.3%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C6 = (props: any) => <HotspotButtonBase name="dashVertR1C6" left="49.8%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C7 = (props: any) => <HotspotButtonBase name="dashVertR1C7" left="56.3%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C8 = (props: any) => <HotspotButtonBase name="dashVertR1C8" left="62.8%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C9 = (props: any) => <HotspotButtonBase name="dashVertR1C9" left="69.3%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C10 = (props: any) => <HotspotButtonBase name="dashVertR1C10" left="75.8%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C11 = (props: any) => <HotspotButtonBase name="dashVertR1C11" left="82.3%" top="9.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR1C12 = (props: any) => <HotspotButtonBase name="dashVertR1C12" left="88.8%" top="9.5%" width="1.0%" height="9.0%" {...props} />;

export const DashVertR2C1 = (props: any) => <HotspotButtonBase name="dashVertR2C1" left="17.3%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C2 = (props: any) => <HotspotButtonBase name="dashVertR2C2" left="23.8%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C3 = (props: any) => <HotspotButtonBase name="dashVertR2C3" left="30.3%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C4 = (props: any) => <HotspotButtonBase name="dashVertR2C4" left="36.8%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C5 = (props: any) => <HotspotButtonBase name="dashVertR2C5" left="43.3%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C6 = (props: any) => <HotspotButtonBase name="dashVertR2C6" left="49.8%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C7 = (props: any) => <HotspotButtonBase name="dashVertR2C7" left="56.3%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C8 = (props: any) => <HotspotButtonBase name="dashVertR2C8" left="62.8%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C9 = (props: any) => <HotspotButtonBase name="dashVertR2C9" left="69.3%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C10 = (props: any) => <HotspotButtonBase name="dashVertR2C10" left="75.8%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C11 = (props: any) => <HotspotButtonBase name="dashVertR2C11" left="82.3%" top="26.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR2C12 = (props: any) => <HotspotButtonBase name="dashVertR2C12" left="88.8%" top="26.5%" width="1.0%" height="9.0%" {...props} />;

export const DashVertR3C1 = (props: any) => <HotspotButtonBase name="dashVertR3C1" left="17.3%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C2 = (props: any) => <HotspotButtonBase name="dashVertR3C2" left="23.8%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C3 = (props: any) => <HotspotButtonBase name="dashVertR3C3" left="30.3%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C4 = (props: any) => <HotspotButtonBase name="dashVertR3C4" left="36.8%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C5 = (props: any) => <HotspotButtonBase name="dashVertR3C5" left="43.3%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C6 = (props: any) => <HotspotButtonBase name="dashVertR3C6" left="49.8%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C7 = (props: any) => <HotspotButtonBase name="dashVertR3C7" left="56.3%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C8 = (props: any) => <HotspotButtonBase name="dashVertR3C8" left="62.8%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C9 = (props: any) => <HotspotButtonBase name="dashVertR3C9" left="69.3%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C10 = (props: any) => <HotspotButtonBase name="dashVertR3C10" left="75.8%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C11 = (props: any) => <HotspotButtonBase name="dashVertR3C11" left="82.3%" top="43.5%" width="1.0%" height="9.0%" {...props} />;
export const DashVertR3C12 = (props: any) => <HotspotButtonBase name="dashVertR3C12" left="88.8%" top="43.5%" width="1.0%" height="9.0%" {...props} />;

// --- NODES (Magenta intersection dots) ---
export const NodeR1C1 = (props: any) => <HotspotButtonBase name="nodeR1C1" left="16.8%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C2 = (props: any) => <HotspotButtonBase name="nodeR1C2" left="23.3%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C3 = (props: any) => <HotspotButtonBase name="nodeR1C3" left="29.8%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C4 = (props: any) => <HotspotButtonBase name="nodeR1C4" left="36.3%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C5 = (props: any) => <HotspotButtonBase name="nodeR1C5" left="42.8%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C6 = (props: any) => <HotspotButtonBase name="nodeR1C6" left="49.3%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C7 = (props: any) => <HotspotButtonBase name="nodeR1C7" left="55.8%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C8 = (props: any) => <HotspotButtonBase name="nodeR1C8" left="62.3%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C9 = (props: any) => <HotspotButtonBase name="nodeR1C9" left="68.8%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C10 = (props: any) => <HotspotButtonBase name="nodeR1C10" left="75.3%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C11 = (props: any) => <HotspotButtonBase name="nodeR1C11" left="81.8%" top="22.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR1C12 = (props: any) => <HotspotButtonBase name="nodeR1C12" left="88.3%" top="22.5%" width="1.0%" height="2.0%" {...props} />;

export const NodeR2C1 = (props: any) => <HotspotButtonBase name="nodeR2C1" left="16.8%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C2 = (props: any) => <HotspotButtonBase name="nodeR2C2" left="23.3%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C3 = (props: any) => <HotspotButtonBase name="nodeR2C3" left="29.8%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C4 = (props: any) => <HotspotButtonBase name="nodeR2C4" left="36.3%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C5 = (props: any) => <HotspotButtonBase name="nodeR2C5" left="42.8%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C6 = (props: any) => <HotspotButtonBase name="nodeR2C6" left="49.3%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C7 = (props: any) => <HotspotButtonBase name="nodeR2C7" left="55.8%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C8 = (props: any) => <HotspotButtonBase name="nodeR2C8" left="62.3%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C9 = (props: any) => <HotspotButtonBase name="nodeR2C9" left="68.8%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C10 = (props: any) => <HotspotButtonBase name="nodeR2C10" left="75.3%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C11 = (props: any) => <HotspotButtonBase name="nodeR2C11" left="81.8%" top="39.5%" width="1.0%" height="2.0%" {...props} />;
export const NodeR2C12 = (props: any) => <HotspotButtonBase name="nodeR2C12" left="88.3%" top="39.5%" width="1.0%" height="2.0%" {...props} />;

// --- NUMBER CENTERS (Green dots) ---
export const NumberCenter0 = (props: any) => <HotspotButtonBase name="number0" left="6.5%" top="27.0%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter1 = (props: any) => <HotspotButtonBase name="number1" left="14.0%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter2 = (props: any) => <HotspotButtonBase name="number2" left="14.0%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter3 = (props: any) => <HotspotButtonBase name="number3" left="14.0%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter4 = (props: any) => <HotspotButtonBase name="number4" left="20.5%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter5 = (props: any) => <HotspotButtonBase name="number5" left="20.5%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter6 = (props: any) => <HotspotButtonBase name="number6" left="20.5%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter7 = (props: any) => <HotspotButtonBase name="number7" left="27.0%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter8 = (props: any) => <HotspotButtonBase name="number8" left="27.0%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter9 = (props: any) => <HotspotButtonBase name="number9" left="27.0%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter10 = (props: any) => <HotspotButtonBase name="number10" left="33.5%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter11 = (props: any) => <HotspotButtonBase name="number11" left="33.5%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter12 = (props: any) => <HotspotButtonBase name="number12" left="33.5%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter13 = (props: any) => <HotspotButtonBase name="number13" left="40.0%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter14 = (props: any) => <HotspotButtonBase name="number14" left="40.0%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter15 = (props: any) => <HotspotButtonBase name="number15" left="40.0%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter16 = (props: any) => <HotspotButtonBase name="number16" left="46.5%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter17 = (props: any) => <HotspotButtonBase name="number17" left="46.5%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter18 = (props: any) => <HotspotButtonBase name="number18" left="46.5%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter19 = (props: any) => <HotspotButtonBase name="number19" left="53.0%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter20 = (props: any) => <HotspotButtonBase name="number20" left="53.0%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter21 = (props: any) => <HotspotButtonBase name="number21" left="53.0%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter22 = (props: any) => <HotspotButtonBase name="number22" left="59.5%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter23 = (props: any) => <HotspotButtonBase name="number23" left="59.5%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter24 = (props: any) => <HotspotButtonBase name="number24" left="59.5%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter25 = (props: any) => <HotspotButtonBase name="number25" left="66.0%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter26 = (props: any) => <HotspotButtonBase name="number26" left="66.0%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter27 = (props: any) => <HotspotButtonBase name="number27" left="66.0%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter28 = (props: any) => <HotspotButtonBase name="number28" left="72.5%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter29 = (props: any) => <HotspotButtonBase name="number29" left="72.5%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter30 = (props: any) => <HotspotButtonBase name="number30" left="72.5%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter31 = (props: any) => <HotspotButtonBase name="number31" left="79.0%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter32 = (props: any) => <HotspotButtonBase name="number32" left="79.0%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter33 = (props: any) => <HotspotButtonBase name="number33" left="79.0%" top="13.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter34 = (props: any) => <HotspotButtonBase name="number34" left="85.5%" top="47.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter35 = (props: any) => <HotspotButtonBase name="number35" left="85.5%" top="30.5%" width="2.0%" height="5.0%" {...props} />;
export const NumberCenter36 = (props: any) => <HotspotButtonBase name="number36" left="85.5%" top="13.5%" width="2.0%" height="5.0%" {...props} />;

// --- OUTER BETS (Column 2:1, Dozens, 1:1) ---
export const Column2_1_Row1 = (props: any) => <HotspotButtonBase name="column2to1_row1" left="91.2%" top="13.5%" width="2.5%" height="5.0%" {...props} />;
export const Column2_1_Row2 = (props: any) => <HotspotButtonBase name="column2to1_row2" left="91.2%" top="30.5%" width="2.5%" height="5.0%" {...props} />;
export const Column2_1_Row3 = (props: any) => <HotspotButtonBase name="column2to1_row3" left="91.2%" top="47.5%" width="2.5%" height="5.0%" {...props} />;

export const Dozen1_12 = (props: any) => <HotspotButtonBase name="dozen1to12" left="23.5%" top="68.0%" width="3.0%" height="5.0%" {...props} />;
export const Dozen2_12 = (props: any) => <HotspotButtonBase name="dozen13to24" left="49.5%" top="68.0%" width="3.0%" height="5.0%" {...props} />;
export const Dozen3_12 = (props: any) => <HotspotButtonBase name="dozen25to36" left="75.5%" top="68.0%" width="3.0%" height="5.0%" {...props} />;

export const OuterBet1to18 = (props: any) => <HotspotButtonBase name="outer1to18" left="17.0%" top="85.0%" width="3.0%" height="5.0%" {...props} />;
export const OuterBetEven = (props: any) => <HotspotButtonBase name="outerEven" left="29.5%" top="85.0%" width="3.0%" height="5.0%" {...props} />;
export const OuterBetRed = (props: any) => <HotspotButtonBase name="outerRed" left="43.5%" top="85.0%" width="3.0%" height="5.0%" {...props} />;
export const OuterBetBlack = (props: any) => <HotspotButtonBase name="outerBlack" left="56.0%" top="85.0%" width="3.0%" height="5.0%" {...props} />;
export const OuterBetOdd = (props: any) => <HotspotButtonBase name="outerOdd" left="69.5%" top="85.0%" width="3.0%" height="5.0%" {...props} />;
export const OuterBet19to36 = (props: any) => <HotspotButtonBase name="outer19to36" left="82.0%" top="85.0%" width="3.0%" height="5.0%" {...props} />;

// Base dimensions - coordinates were authored at this size
export const HOTSPOT_BASE_WIDTH = 1000;
export const HOTSPOT_BASE_HEIGHT = 420;

// --- MAIN OVERLAY COMPONENT ---
export interface RouletteHotspotsOverlayProps {
    onHotspotClick?: (name: string) => void;
    debug?: boolean;
    /** Global X offset in pixels to shift all hotspots together (applied after scaling) */
    offsetX?: number;
    /** Global Y offset in pixels to shift all hotspots together (applied after scaling) */
    offsetY?: number;
    /** Scale factor to match board's rendered size (default 1) */
    scale?: number;
    /** Show debug info panel */
    showDebugInfo?: boolean;
    /** Current board width for debug display */
    boardWidth?: number;
    /** Current board height for debug display */
    boardHeight?: number;
}

export const RouletteHotspotsOverlay: React.FC<RouletteHotspotsOverlayProps> = ({
    onHotspotClick,
    debug = false,
    offsetX = 0,
    offsetY = 0,
    scale = 1,
    showDebugInfo = false,
    boardWidth = 0,
    boardHeight = 0
}) => {
    return (
        <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${HOTSPOT_BASE_WIDTH}px`,
            height: `${HOTSPOT_BASE_HEIGHT}px`,
            pointerEvents: 'none',
            transformOrigin: 'top left',
            transform: `translate(${offsetX}px, ${offsetY}px) scale(${scale})`,
        }}>
            {/* Debug Info Panel */}
            {showDebugInfo && (
                <div style={{
                    position: 'fixed',
                    top: 10,
                    right: 10,
                    background: 'rgba(0,0,0,0.8)',
                    color: 'lime',
                    padding: '10px',
                    borderRadius: '5px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                    zIndex: 9999,
                    pointerEvents: 'auto'
                }}>
                    <div>Base: {HOTSPOT_BASE_WIDTH}x{HOTSPOT_BASE_HEIGHT}</div>
                    <div>Board: {boardWidth.toFixed(0)}x{boardHeight.toFixed(0)}</div>
                    <div>Scale: {scale.toFixed(4)}</div>
                    <div>Offset: ({offsetX}, {offsetY})</div>
                </div>
            )}

            {/* Grouping markers in the same div */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'auto',
            }}>

                {/* Street Top */}
                <StreetTopYellow1 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan1 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow2 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan2 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow3 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan3 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow4 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan4 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow5 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan5 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow6 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan6 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow7 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan7 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow8 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan8 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow9 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan9 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow10 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan10 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow11 onClick={onHotspotClick} debug={debug} />
                <StreetTopCyan11 onClick={onHotspotClick} debug={debug} />
                <StreetTopYellow12 onClick={onHotspotClick} debug={debug} />

                {/* Street Bottom */}
                <StreetBottomYellow1 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan1 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow2 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan2 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow3 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan3 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow4 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan4 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow5 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan5 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow6 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan6 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow7 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan7 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow8 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan8 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow9 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan9 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow10 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan10 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow11 onClick={onHotspotClick} debug={debug} />
                <StreetBottomCyan11 onClick={onHotspotClick} debug={debug} />
                <StreetBottomYellow12 onClick={onHotspotClick} debug={debug} />

                {/* Dashes Horiz */}
                <DashHorizR1C1 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C2 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C3 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C4 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C5 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C6 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C7 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C8 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C9 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C10 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C11 onClick={onHotspotClick} debug={debug} />
                <DashHorizR1C12 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C1 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C2 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C3 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C4 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C5 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C6 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C7 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C8 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C9 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C10 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C11 onClick={onHotspotClick} debug={debug} />
                <DashHorizR2C12 onClick={onHotspotClick} debug={debug} />

                {/* Dashes Vert */}
                <DashVertR1C0 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C0 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C0 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C1 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C2 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C3 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C4 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C5 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C6 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C7 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C8 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C9 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C10 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C11 onClick={onHotspotClick} debug={debug} />
                <DashVertR1C12 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C1 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C2 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C3 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C4 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C5 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C6 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C7 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C8 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C9 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C10 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C11 onClick={onHotspotClick} debug={debug} />
                <DashVertR2C12 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C1 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C2 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C3 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C4 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C5 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C6 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C7 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C8 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C9 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C10 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C11 onClick={onHotspotClick} debug={debug} />
                <DashVertR3C12 onClick={onHotspotClick} debug={debug} />

                {/* Nodes */}
                <NodeR1C1 onClick={onHotspotClick} debug={debug} />
                <NodeR1C2 onClick={onHotspotClick} debug={debug} />
                <NodeR1C3 onClick={onHotspotClick} debug={debug} />
                <NodeR1C4 onClick={onHotspotClick} debug={debug} />
                <NodeR1C5 onClick={onHotspotClick} debug={debug} />
                <NodeR1C6 onClick={onHotspotClick} debug={debug} />
                <NodeR1C7 onClick={onHotspotClick} debug={debug} />
                <NodeR1C8 onClick={onHotspotClick} debug={debug} />
                <NodeR1C9 onClick={onHotspotClick} debug={debug} />
                <NodeR1C10 onClick={onHotspotClick} debug={debug} />
                <NodeR1C11 onClick={onHotspotClick} debug={debug} />
                <NodeR1C12 onClick={onHotspotClick} debug={debug} />
                <NodeR2C1 onClick={onHotspotClick} debug={debug} />
                <NodeR2C2 onClick={onHotspotClick} debug={debug} />
                <NodeR2C3 onClick={onHotspotClick} debug={debug} />
                <NodeR2C4 onClick={onHotspotClick} debug={debug} />
                <NodeR2C5 onClick={onHotspotClick} debug={debug} />
                <NodeR2C6 onClick={onHotspotClick} debug={debug} />
                <NodeR2C7 onClick={onHotspotClick} debug={debug} />
                <NodeR2C8 onClick={onHotspotClick} debug={debug} />
                <NodeR2C9 onClick={onHotspotClick} debug={debug} />
                <NodeR2C10 onClick={onHotspotClick} debug={debug} />
                <NodeR2C11 onClick={onHotspotClick} debug={debug} />
                <NodeR2C12 onClick={onHotspotClick} debug={debug} />

                {/* Number Centers */}
                <NumberCenter0 onClick={onHotspotClick} debug={debug} />
                <NumberCenter1 onClick={onHotspotClick} debug={debug} />
                <NumberCenter2 onClick={onHotspotClick} debug={debug} />
                <NumberCenter3 onClick={onHotspotClick} debug={debug} />
                <NumberCenter4 onClick={onHotspotClick} debug={debug} />
                <NumberCenter5 onClick={onHotspotClick} debug={debug} />
                <NumberCenter6 onClick={onHotspotClick} debug={debug} />
                <NumberCenter7 onClick={onHotspotClick} debug={debug} />
                <NumberCenter8 onClick={onHotspotClick} debug={debug} />
                <NumberCenter9 onClick={onHotspotClick} debug={debug} />
                <NumberCenter10 onClick={onHotspotClick} debug={debug} />
                <NumberCenter11 onClick={onHotspotClick} debug={debug} />
                <NumberCenter12 onClick={onHotspotClick} debug={debug} />
                <NumberCenter13 onClick={onHotspotClick} debug={debug} />
                <NumberCenter14 onClick={onHotspotClick} debug={debug} />
                <NumberCenter15 onClick={onHotspotClick} debug={debug} />
                <NumberCenter16 onClick={onHotspotClick} debug={debug} />
                <NumberCenter17 onClick={onHotspotClick} debug={debug} />
                <NumberCenter18 onClick={onHotspotClick} debug={debug} />
                <NumberCenter19 onClick={onHotspotClick} debug={debug} />
                <NumberCenter20 onClick={onHotspotClick} debug={debug} />
                <NumberCenter21 onClick={onHotspotClick} debug={debug} />
                <NumberCenter22 onClick={onHotspotClick} debug={debug} />
                <NumberCenter23 onClick={onHotspotClick} debug={debug} />
                <NumberCenter24 onClick={onHotspotClick} debug={debug} />
                <NumberCenter25 onClick={onHotspotClick} debug={debug} />
                <NumberCenter26 onClick={onHotspotClick} debug={debug} />
                <NumberCenter27 onClick={onHotspotClick} debug={debug} />
                <NumberCenter28 onClick={onHotspotClick} debug={debug} />
                <NumberCenter29 onClick={onHotspotClick} debug={debug} />
                <NumberCenter30 onClick={onHotspotClick} debug={debug} />
                <NumberCenter31 onClick={onHotspotClick} debug={debug} />
                <NumberCenter32 onClick={onHotspotClick} debug={debug} />
                <NumberCenter33 onClick={onHotspotClick} debug={debug} />
                <NumberCenter34 onClick={onHotspotClick} debug={debug} />
                <NumberCenter35 onClick={onHotspotClick} debug={debug} />
                <NumberCenter36 onClick={onHotspotClick} debug={debug} />

                {/* Outer Bets */}
                <Column2_1_Row1 onClick={onHotspotClick} debug={debug} />
                <Column2_1_Row2 onClick={onHotspotClick} debug={debug} />
                <Column2_1_Row3 onClick={onHotspotClick} debug={debug} />
                <Dozen1_12 onClick={onHotspotClick} debug={debug} />
                <Dozen2_12 onClick={onHotspotClick} debug={debug} />
                <Dozen3_12 onClick={onHotspotClick} debug={debug} />
                <OuterBet1to18 onClick={onHotspotClick} debug={debug} />
                <OuterBetEven onClick={onHotspotClick} debug={debug} />
                <OuterBetRed onClick={onHotspotClick} debug={debug} />
                <OuterBetBlack onClick={onHotspotClick} debug={debug} />
                <OuterBetOdd onClick={onHotspotClick} debug={debug} />
                <OuterBet19to36 onClick={onHotspotClick} debug={debug} />

            </div>
        </div>
    );
};
