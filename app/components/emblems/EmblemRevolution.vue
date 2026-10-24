<!-- 「革命したい」のエンブレム。SVG はモックからそのまま移植している -->
<template>
  <svg
    viewBox="0 0 320 320"
    role="img"
    aria-label="逆さになって傾くピラミッドに赤い楔が突き刺さる"
  >
    <g
      class="spin amb"
      fill="#2A2321"
    >
      <polygon points="160,170 420,170 411.1,102.7" />
      <polygon points="160,170 385.2,40 343.8,-13.8" />
      <polygon points="160,170 290,-55.2 227.3,-81.1" />
      <polygon points="160,170 160,-90 92.7,-81.1" />
      <polygon points="160,170 30,-55.2 -23.8,-13.8" />
      <polygon points="160,170 -65.2,40 -91.1,102.7" />
      <polygon points="160,170 -100,170 -91.1,237.3" />
      <polygon points="160,170 -65.2,300 -23.8,353.8" />
      <polygon points="160,170 30,395.2 92.7,421.1" />
      <polygon points="160,170 160,430 227.3,421.1" />
      <polygon points="160,170 290,395.2 343.8,353.8" />
      <polygon points="160,170 385.2,300 411.1,237.3" />
    </g>
    <path
      d="M42.5 212.8 A125 125 0 0 1 268.3 107.5"
      fill="none"
      stroke="#E8432A"
      stroke-width="12"
    />
    <polygon
      points="285.4,98.7 254.1,116.8 280.3,129"
      fill="#E8432A"
    />
    <g class="wobble amb">
      <polygon
        points="70,90 250,90 160,250"
        fill="#F4F0E8"
      />
      <g
        stroke="#141212"
        stroke-width="5"
      >
        <line
          x1="95.3"
          y1="135"
          x2="224.7"
          y2="135"
        />
        <line
          x1="120.6"
          y1="180"
          x2="199.4"
          y2="180"
        />
        <line
          x1="140.3"
          y1="215"
          x2="179.7"
          y2="215"
        />
      </g>
      <g fill="#141212">
        <circle
          cx="93"
          cy="106"
          r="4.5"
        /><circle
          cx="107"
          cy="106"
          r="4.5"
        /><circle
          cx="121"
          cy="106"
          r="4.5"
        /><circle
          cx="135"
          cy="106"
          r="4.5"
        /><circle
          cx="149"
          cy="106"
          r="4.5"
        /><circle
          cx="163"
          cy="106"
          r="4.5"
        /><circle
          cx="177"
          cy="106"
          r="4.5"
        /><circle
          cx="191"
          cy="106"
          r="4.5"
        /><circle
          cx="205"
          cy="106"
          r="4.5"
        /><circle
          cx="219"
          cy="106"
          r="4.5"
        />
        <circle
          cx="100"
          cy="120"
          r="4.5"
        /><circle
          cx="114"
          cy="120"
          r="4.5"
        /><circle
          cx="128"
          cy="120"
          r="4.5"
        /><circle
          cx="142"
          cy="120"
          r="4.5"
        /><circle
          cx="156"
          cy="120"
          r="4.5"
        /><circle
          cx="170"
          cy="120"
          r="4.5"
        /><circle
          cx="184"
          cy="120"
          r="4.5"
        /><circle
          cx="198"
          cy="120"
          r="4.5"
        /><circle
          cx="212"
          cy="120"
          r="4.5"
        />
        <circle
          cx="160"
          cy="232"
          r="5.5"
        />
      </g>
    </g>
    <g class="thrust amb">
      <polygon
        points="-24,248 8,334 154,198"
        fill="#E8432A"
      />
    </g>
  </svg>
</template>

<style scoped>
  .spin{transform-box:view-box;transform-origin:160px 170px;animation:spin 90s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .wobble{transform-box:view-box;transform-origin:160px 170px;transform:rotate(14deg);animation:wobble 5s ease-in-out infinite}
  @keyframes wobble{0%,100%{transform:rotate(11deg)}50%{transform:rotate(18deg)}}
  .thrust{animation:thrust 1.8s ease-in-out infinite}
  @keyframes thrust{0%,100%{transform:translate(-9px,7px)}50%{transform:translate(0,0)}}
@media (prefers-reduced-motion: reduce) {
  .amb { animation: none !important; }
}
</style>
