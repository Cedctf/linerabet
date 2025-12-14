import React from "react";
// Chip component is no longer needed for single-bubble display
// import Chip from "./Chip";
import classNames from "classnames";

function ChipComponent(props: { currentItemChips: any; tdKey: any; cellClass: any; chipKey: any; cell: any; leftMin: number | undefined; leftMax: number | undefined; topMin: number | undefined; topMax: number | undefined; rowSpan: number | undefined; colSpan: number | undefined; onCellClick: (arg0: any) => void; }) {

    var currentItemChips = props.currentItemChips;
    var tdKey = props.tdKey;
    var cellClass = props.cellClass;
    var cell = props.cell;

    var sum = 0;
    if (currentItemChips !== undefined) {
        if (currentItemChips.sum !== 0) {
            sum = currentItemChips.sum;
        }
    }

    var left = 0;
    var top = -15;

    if (props.leftMin !== undefined && props.leftMax !== undefined) {
        left = props.leftMin + (props.leftMax - props.leftMin) / 2;
    }

    if (props.topMin !== undefined && props.topMax !== undefined) {
        top = props.topMin + (props.topMax - props.topMin) / 2;
    }

    // Centering the single chip
    let style: any = {
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        position: "absolute",
        zIndex: 10
    };

    // Override with custom positions if provided (for special bets)
    if ((props.leftMin !== undefined || props.topMin !== undefined)) {
        style = {
            top: top + "px",
            left: left + "px",
            position: "absolute",
            zIndex: 10
        };
    }

    function getChipClass(val: number) {
        return classNames({
            "chip-100-placed": val >= 100,
            "chip-20-placed": val >= 20 && val < 50, // Gap between 20 and 100? Assuming logic
            "chip-10-placed": val >= 10 && val < 20,
            "chip-5-placed": val < 10,
            "chipValueImage": true // Ensures flex centering from CSS
        });
    }

    return (
        <td
            key={tdKey}
            className={cellClass}
            rowSpan={props.rowSpan}
            colSpan={props.colSpan}
            onClick={(e) => {
                props.onCellClick(cell);
            }}
            style={{ position: "relative" }} // Needed for absolute positioning of chip
        >
            {/* Render ONLY if there is a bet */}
            {sum > 0 && (
                <div style={style} className={getChipClass(sum)}>
                    {sum}
                </div>
            )}
        </td>
    );
}

export default React.memo(ChipComponent);
