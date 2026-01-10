export default function Home() {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor: '#000'
      }}
    >
      <img
        src="/Landing.png"
        alt="Background"
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'fill'
        }}
      />
    </div>
  );
}
