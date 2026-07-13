import "./SpeechBubble.css";

type Props = {
  text: string;
  onDismiss: () => void;
};

function SpeechBubble({ text, onDismiss }: Props) {
  return (
    <div className="bubble" onClick={onDismiss} title="click to dismiss">
      {text}
      <div className="bubble-tail" />
    </div>
  );
}

export default SpeechBubble;