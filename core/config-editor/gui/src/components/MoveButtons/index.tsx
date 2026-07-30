
import arrow from "./arrow.svg";
import "./move.css";

export function MoveButtons({ index, items, onMove }: {
  index: number;
  items: Array<any>;
  onMove: (newIndex: number)=>unknown;
}){
  const upText = index === 0 ? 'Is First' : 'Move Up';
  const downText = index === items.length - 1 ? 'Is Last' : 'Move Down';
  return (
    <div className="move-buttons">
      <button
        disabled={index === 0}
        onClick={() => onMove(index - 1)}
      >
        <img src={arrow} alt={upText} />
        <span>{upText}</span>
      </button>
      <button
        disabled={index === items.length - 1}
        onClick={() => onMove(index + 1)}
      >
        <img src={arrow} alt={downText} style={{ transform: "rotate(180deg)" }} />
        <span>{downText}</span>
      </button>
    </div>
  )

}