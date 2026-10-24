<!-- 「国外脱出したい」のエンブレム。SVG はモックからそのまま移植している -->
<template>
  <svg
    viewBox="0 0 320 320"
    role="img"
    aria-label="国境の引かれた地球の殻を破り、光の軌跡が外へ飛び出す"
  >
    <g fill="#EEF0FA">
      <circle
        class="twinkle amb"
        cx="30"
        cy="40"
        r="2"
      />
      <circle
        class="twinkle amb"
        cx="70"
        cy="22"
        r="1.5"
        style="animation-delay: .8s"
      />
      <circle
        class="twinkle amb"
        cx="110"
        cy="34"
        r="2.2"
        style="animation-delay: 1.6s"
      />
      <circle
        class="twinkle amb"
        cx="250"
        cy="30"
        r="1.6"
        style="animation-delay: .4s"
      />
      <circle
        class="twinkle amb"
        cx="300"
        cy="96"
        r="2.2"
        style="animation-delay: 1.2s"
      />
      <circle
        class="twinkle amb"
        cx="26"
        cy="122"
        r="1.6"
        style="animation-delay: 2s"
      />
      <circle
        class="twinkle amb"
        cx="292"
        cy="186"
        r="2"
        style="animation-delay: .2s"
      />
      <circle
        class="twinkle amb"
        cx="300"
        cy="268"
        r="1.5"
        style="animation-delay: 1.4s"
      />
      <circle
        class="twinkle amb"
        cx="18"
        cy="300"
        r="2"
        style="animation-delay: .6s"
      />
    </g>
    <circle
      cx="140"
      cy="190"
      r="105"
      fill="#24358A"
    />
    <path
      d="M80 150 C100 120 150 118 170 140 C190 160 215 150 225 175 C235 205 205 240 175 235 C150 232 140 260 112 250 C85 240 70 210 78 185 Z"
      fill="#3A4FB0"
    />
    <g
      fill="none"
      stroke="#EEF0FA"
      stroke-opacity=".28"
      stroke-width="2"
    >
      <ellipse
        cx="140"
        cy="190"
        rx="40"
        ry="105"
      />
      <ellipse
        cx="140"
        cy="190"
        rx="78"
        ry="105"
      />
      <line
        x1="35"
        y1="190"
        x2="245"
        y2="190"
      />
      <line
        x1="43"
        y1="150"
        x2="237"
        y2="150"
      />
      <line
        x1="43"
        y1="230"
        x2="237"
        y2="230"
      />
      <line
        x1="72"
        y1="110"
        x2="208"
        y2="110"
      />
      <line
        x1="72"
        y1="270"
        x2="208"
        y2="270"
      />
    </g>
    <path
      d="M118 128 L132 160 L120 190 L148 214 L140 248"
      fill="none"
      stroke="#EEF0FA"
      stroke-width="3"
      stroke-dasharray="6 5"
    />
    <path
      d="M192.5 99.1 A105 105 0 1 0 238.7 154.1"
      fill="none"
      stroke="#EEF0FA"
      stroke-width="5"
    />
    <g fill="#EEF0FA">
      <polygon points="232,108 246,99 241,115" />
      <polygon points="251,128 265,123 256,138" />
      <polygon points="219,90 228,77 233,93" />
    </g>
    <path
      d="M150 200 C185 172 225 125 286 40"
      fill="none"
      stroke="#FFB23A"
      stroke-opacity=".28"
      stroke-width="22"
      stroke-linecap="round"
    />
    <path
      class="march amb"
      d="M150 200 C185 172 225 125 286 40"
      fill="none"
      stroke="#FFB23A"
      stroke-width="6"
      stroke-linecap="round"
    />
    <circle
      cx="150"
      cy="200"
      r="6"
      fill="#EEF0FA"
    />
    <circle
      class="pulse amb"
      cx="286"
      cy="40"
      r="20"
      fill="none"
      stroke="#FFB23A"
      stroke-width="3"
    />
    <circle
      cx="286"
      cy="40"
      r="12"
      fill="#FFB23A"
    />
  </svg>
</template>

<style scoped>
  .twinkle{animation:twinkle 2.6s ease-in-out infinite}
  @keyframes twinkle{0%,100%{opacity:1}50%{opacity:.2}}
  .march{stroke-dasharray:14 10;animation:march 1.1s linear infinite}
  @keyframes march{to{stroke-dashoffset:-24}}
  .pulse{transform-box:fill-box;transform-origin:50% 50%;animation:pulse 1.8s ease-out infinite}
  @keyframes pulse{0%{transform:scale(.7);opacity:.7}100%{transform:scale(1.6);opacity:0}}
@media (prefers-reduced-motion: reduce) {
  .amb { animation: none !important; }
}
</style>
