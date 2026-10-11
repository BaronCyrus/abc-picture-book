# 插画生成提示词（风格手册）

所有插画都用 ChatGPT 图像生成（Pro 推理）制作，统一为「儿童绘本剪纸拼贴」风格。
以后要新增字母 / 单词 / 道具，沿用下面的模板即可保持画风一致。

## 通用风格段（每条提示词都带上）

```
Style: children's picture-book cut-paper collage, exactly the same style as the previous images:
simple bold rounded shapes cut from hand-painted textured paper (visible dry-brush strokes and
paper grain), layered like real paper pieces with very subtle soft shadows between the layers.
Bright, warm, cheerful colors. Cute and friendly, no outlines, no text, no letters.
```

## 单个主体（单词主图、道具）

```
Generate an image (do not ask questions, just generate): <主体描述>. <通用风格段>
Composition: isolated subject only, centered, whole subject visible with a small margin, filling
about 80% of the frame. Fully transparent background (real PNG alpha channel). No ground, no cast
shadow, no frame, no other elements. Square 1:1.
```

要点：

- 动物统一写 `full side view facing right`（侧面朝右），这样在场景里向右走 / 跑才自然。
- 物品要写明 `no face`，否则偶尔会被画上表情（果汁那张重画过一次）。
- 需要同一角色的第二个姿势时，在**同一个对话**里紧接着要：`the same ... as in the previous image, but now ...`（狮子吼叫、合上的雨伞就是这样做的）。

## 多个零件排成一张（纸偶、装饰、孵蛋零件）

```
Generate an image (do not ask questions, just generate): <零件清单>. <通用风格段>
Composition: a tidy sheet of SEPARATE pieces with wide empty gaps between them, nothing
overlapping, nothing touching, each piece complete. Fully transparent background (real PNG alpha
channel). No ground, no cast shadows on the background, no frame, no labels, no numbers. Square 1:1.
```

然后用 `tools/art.py slice <文件名>` 自动按连通区域切成单独的零件。

### 小朋友纸偶（kid_parts_v1）

```
an UNASSEMBLED articulated paper puppet kit (split-pin jointed paper doll parts sheet) of a cute
4-year-old child, front view. All pieces are SEPARATE ... Pieces:
(1) HEAD A: big round head, short black hair with a small tuft, warm peach skin, rosy cheeks,
    small ears, round black dot eyes open, gentle closed-mouth smile, tiny neck stub at the bottom.
(2) HEAD B: identical to head A but with eyes happily closed as two little upward curves.
(3) HEAD C: identical to head A but with a big open-mouth joyful laughing smile.
(4) TORSO: one piece, sunny yellow short t-shirt body with blue shorts at the bottom, no head,
    no arms, no legs.
(5) UPPER ARM: one short piece with a yellow sleeve, rounded at both ends.
(6) FOREARM WITH HAND: one piece, peach skin, simple rounded mitten-like hand, rounded at the elbow end.
(7) LEG: one straight leg piece, peach skin with a white sock and a red shoe, rounded at the top.
All three heads the same size; limb pieces in correct proportion to the torso for a chubby toddler
(big head, short limbs). ... no pins, no holes, no labels, no numbers, no text.
```

关节位置写在 `src/gl/kid.js` 顶部的 `RIG` 里；换一套纸偶零件时只需要重新量这几个点。

## 26 个主体的描述

| 字母 | 文件 | 主体描述 |
| --- | --- | --- |
| A | a_apple | a single shiny red apple with a short brown stem and one small green leaf |
| A | a_tree | a big apple tree: a thick brown trunk and a large round fluffy green crown made of layered paper leaves, with about eight red apples spread in the crown |
| B | b_ball | a single toy ball with bold red, yellow and blue curved stripes and a small white highlight, perfectly round |
| C | c_cat | a cute orange tabby cat sitting upright, front view, big friendly eyes, pink nose, small smile, tail curled around its feet |
| D | d_dog | a cute happy brown puppy dog standing on four legs, full side view facing right, floppy ears, tongue out, tail up, red collar |
| E | e_egg | a single smooth cream-white chicken egg standing upright, with soft pale shading |
| E | e_eggkit | An egg hatching kit of 3 pieces: bottom half of a cracked eggshell (zigzag top edge), the top cap (zigzag bottom edge), a cute fluffy yellow baby chick with wings raised |
| F | f_fish | a cute orange and yellow fish with a few blue stripes, full side view facing right, round friendly eye, small smile, flowing tail and fins |
| G | g_goat | a cute white goat standing on four legs, full side view facing right, small horns, little beard, friendly face |
| H | h_hat | a yellow straw sun hat with a wide round brim and a red ribbon band, seen straight from the front at eye level as if worn on a head |
| I | i_icecream | an ice cream cone: one big pink strawberry scoop on a golden waffle cone, with a few colorful sprinkles |
| J | j_juice2 | a clear drinking glass full of orange juice with a red-and-white striped straw and an orange slice on the rim. Plain realistic object: absolutely NO face |
| K | k_kite | a diamond-shaped kite with red, yellow and blue panels, with a long tail hanging straight down decorated with three small colorful bows |
| L | l_lion | a cute friendly lion sitting upright, front view, big fluffy orange-brown mane, golden body, gentle closed-mouth smile, tail with a tuft |
| L | l_lion_roar | the same lion ... but now ROARING: mouth wide open showing a pink tongue and small white teeth, eyes squeezed shut, mane puffed up bigger |
| M | m_moon | a glowing yellow crescent moon, no face |
| N | n_noodles | a red bowl full of yellow noodles, topped with half a boiled egg and a few green vegetable leaves, with a pair of chopsticks resting on the bowl |
| O | o_octopus | a cute purple octopus, front view, round head, big friendly eyes, small smile, eight curly arms spreading out below |
| P | p_pig | a cute pink pig standing on four legs, full side view facing right, curly tail, big snout, happy face |
| Q | q_queen | a kind smiling queen standing, front view, full body, golden crown with red jewels, long royal purple robe with white fur trim, small golden scepter |
| R | r_rainbow | a rainbow arch with seven clear color bands, with a small fluffy white cloud at each end |
| S | s_sun | a bright yellow sun: a round disc with a ring of orange and yellow triangular rays, no face |
| T | t_teddy | a cute brown teddy bear sitting, front view, round ears, cream tummy and muzzle, red bow tie, arms slightly open |
| U | u_umbrella | an open umbrella, red with white polka dots, with a curved yellow handle, upright, seen from the side |
| U | u_umbrella_closed | the same umbrella ... but now CLOSED and folded, pointing straight up with the handle at the bottom |
| V | v_van | a cute turquoise van, full side view facing right, round wheels, big windows, friendly rounded shape, small headlights |
| W | w_whale | a cute big blue whale, full side view facing right, light belly, friendly eye, gentle smile, tail raised, with no water spout |
| X | x_fox | a cute orange fox sitting upright, front view, white chest and muzzle, big bushy tail with a white tip, friendly eyes |
| X | x_box | an open cardboard box seen from the front, plain brown corrugated cardboard, the four top flaps open outward, empty |
| Y | y_yoyo | a classic toy yo-yo seen at a three-quarter angle, red halves with a yellow star on the front face, white string wrapped in the gap with a short piece of string going straight up ending in a small finger loop |
| Z | z_zebra | a cute zebra standing on four legs, full side view facing right, bold black and white stripes, short upright mane, friendly face |
| – | decor | 8 small nature decorations: two clouds, a bush, a tuft of grass, a red flower, a yellow flower, a blue butterfly, a small red bird facing right |
| – | seadecor | 6 underwater decorations: a tall seaweed, a shorter dark seaweed, a pink coral, an orange starfish, a spiral seashell, a small grey rock |
