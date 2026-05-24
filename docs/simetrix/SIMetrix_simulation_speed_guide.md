# SIMetrix 操作手冊：Transient 模擬速度優化

## 目的

本章節用於協助工程師在 SIMetrix 中處理 transient 模擬過慢、timestep 掉到極小、switching edge 附近不收斂、或高頻 ringing 造成模擬卡住等問題。

核心原則是：

1. 先讓電路用較寬鬆、較容易收斂的設定跑通。
2. 再逐步收緊 timestep、誤差容許與元件模型。
3. 最終結果仍需回到接近實際條件的設定做驗證。

此流程適合 switching power stage、GaN / MOSFET half bridge、buck / boost / LLC 類電源電路，以及含 gate driver、controller、comparator 的暫態模擬。

## 建議調整順序

當 transient 模擬過慢或不收斂時，建議依下列順序處理：

1. 檢查 transient timestep 設定。
2. 先放寬誤差容許，確認是否能跑通。
3. 降低理想元件造成的無限斜率或無限阻抗。
4. 補上必要的 ESR、DCR、gate resistor、leakage path。
5. 將 bus、enable、soft-start 等啟動條件分開。
6. 用簡化 power stage 定位問題區塊。
7. 跑通後再逐步恢復真實參數與較嚴格設定。

## 快速設定建議表

| 類別 | 可調整項目 | 建議起始值 | 主要效果 | 代價 / 注意事項 |
| --- | --- | --- | --- | --- |
| Transient 設定 | Max time step | Ts/50 ~ Ts/200，例如 1 ns ~ 5 ns | 避免漏掉 switching edge、dead time、尖峰 | 越小越慢 |
| Transient 設定 | Min time step | Default | 避免模擬器掉到極小 timestep 卡很久 | 設太大可能直接不收斂 |
| Transient 設定 | Integration method | 先試 Gear | 改善高頻 ringing 導致的收斂問題 | Gear 會有數值阻尼，振鈴與尖峰可能偏小 |
| 誤差容許 | Relative tolerance | 3 m，再試 5 m | 較容易收斂，速度可能變快 | 精度下降，尤其小 ripple / overshoot |
| 誤差容許 | Current tolerance | 10 pA ~ 100 pA | 放寬小電流誤差，power stage 常有幫助 | 不適合觀察 leakage / nA 等級電流 |
| 誤差容許 | Voltage tolerance | 10 uV ~ 100 uV | 減少微伏級誤差造成的迭代 | 不適合觀察極小 ripple / noise |
| 溫度 | TEMP | Debug 先用 25C，確認後回 120C | 排除高溫模型造成的收斂困難 | 最終結果仍應用實際溫度驗證 |
| Gate drive | PULSE rise / fall | 5 ns ~ 10 ns 先測，之後降回真實值 | 減少理想瞬間切換，改善 timestep 過小 | 邊緣變慢，損耗與尖峰會和真實值不同 |
| Gate drive | 外部 gate resistor | 5 ohm ~ 10 ohm 先測 | 降低 di/dt、dv/dt，改善振鈴與收斂 | 會改變 switching loss / switching speed |
| Gate drive | Gate driver 參考點 | Vdrv gate_drv source | 對 floating source / 上管更合理 | 接錯參考點會造成不真實 Vgs |
| Gate drive | Gate-source resistor | 100 kohm ~ 1 Mohm | 避免 gate 浮接，幫助 DC operating point | 太小會增加 driver loading |
| 電源 | Bus source ramp | PWL(0 0 10u Vbus) | 避免 t = 0 瞬間上電衝擊 | Startup 行為會被改變 |
| 電源 | Bus source 串聯電阻 | 20 mohm ~ 100 mohm | 避免理想電壓源提供無限瞬間電流 | 會產生壓降與損耗 |
| 電容 | 大電容 ESR | 10 mohm ~ 100 mohm | 阻尼高頻振鈴，讓模型更接近真實 | 會改變 ripple / 損耗 |
| 電感 | 電感 DCR | 10 mohm ~ 100 mohm 或依 datasheet | 避免理想 LC 高 Q 振盪 | 會改變效率與壓降 |
| 浮動節點 | Leakage resistor | 10 Mohm ~ 100 Mohm 到地或參考點 | 給浮接節點 DC path，改善 operating point | 太小會影響高阻節點電壓 |
| Switch node | RC snubber | 例如 5 ohm + 100 pF | 阻尼 switch node ringing，改善收斂 | 會增加損耗，需依實際調整 |
| Ideal 元件 | Ideal switch / diode 參數 | Ron 不為 0，Roff 有限 | 避免無限斜率 / 無限阻抗 | 會和理想模型結果不同 |
| Comparator | Hysteresis | 視門檻加小量回授 | 避免臨界點高速抖動 | 會改變切換門檻 |
| Controller | Soft-start / enable delay | Enable 晚於 bus，例如 20 us 後啟動 | 避免所有非線性元件 t = 0 同時動作 | Startup 時序改變 |
| 初始條件 | 電容電壓 .ic | .ic V(vout)=目標值 | 快速接近穩態，縮短模擬時間 | 不適合觀察完整 startup |
| 初始條件 | 電感電流 IC= | Lout ... IC=估計電流 | 避免從不合理初始電流開始 | 初值錯誤會造成不真實暫態 |
| 模擬策略 | 先跑簡化 power stage | 單顆 GaN + bus + load | 快速定位是模型 / 驅動 / 控制問題 | 不能代表完整系統 |
| 模擬策略 | 分段驗證 | 先 power stage，再加 controller | 找出拖慢收斂的區塊 | 需要多次測試 |
| 模擬策略 | 穩態才細看 | 先寬鬆設定跑通，再收緊驗證 | 節省 debug 時間 | 最終仍要用較準設定確認 |

## Transient 設定

### Max time step

Max time step 是最常影響 switching 模擬結果與速度的設定。

建議起始值：

```text
Max time step = Ts/50 ~ Ts/200
```

範例：

```text
Switching frequency = 1 MHz
Ts = 1 us
Max time step = 5 ns ~ 20 ns
```

若需要觀察 dead time、switch node spike、gate ringing、diode reverse recovery 等快速事件，Max time step 需要再縮小。若只是先確認控制迴路或 startup 大方向，可以先用較大的 timestep 跑通。

注意事項：

- Max time step 越小，波形越細，但模擬時間會明顯增加。
- 太大的 Max time step 可能漏掉 switching edge，導致尖峰、dead time 或短暫導通狀態不準。
- Debug 階段可先放寬；最終波形檢查時再縮小。

### Min time step

一般建議維持 default。

不要一開始就把 Min time step 設太大，因為這可能讓 SIMetrix 在需要細 timestep 的時候無法自動縮小，反而直接不收斂。

只有在確認模擬器掉到極小 timestep 且該區間不具物理意義時，才考慮調整。

### Integration method

若電路有高頻 ringing、理想 LC、高速 switching edge，建議先試 Gear。

Gear 的好處：

- 對高頻振盪較穩定。
- 常能改善 switching circuit 的收斂。
- 對含寄生 LC 的 power stage 較容易跑通。

Gear 的代價：

- 會引入數值阻尼。
- 振鈴、尖峰、overshoot 可能偏小。
- 若目標是精準觀察 ringing，最終仍需比較其他 method 或收緊設定。

## 誤差容許設定

### Relative tolerance

Debug 建議：

```text
Relative tolerance = 3m
```

若仍不易收斂，可試：

```text
Relative tolerance = 5m
```

這會讓 SIMetrix 接受較大的相對誤差，因此通常能改善收斂與速度。

注意事項：

- Ripple、overshoot、small signal noise 可能變得不準。
- 最終報告或 design sign-off 不應只依賴放寬後的設定。

### Current tolerance

Power stage debug 時可先試：

```text
Current tolerance = 10 pA ~ 100 pA
```

這對大電流切換電路通常有幫助，因為模擬器不會在極小電流誤差上花太多迭代。

若正在觀察 leakage、bias current、nA 等級電流，不建議放太寬。

### Voltage tolerance

建議起始值：

```text
Voltage tolerance = 10 uV ~ 100 uV
```

這可減少微伏級誤差造成的迭代，對 switching power stage debug 常有幫助。

若正在觀察極小 ripple、noise、offset，需回到較嚴格設定驗證。

## Gate Drive 相關設定

### PULSE rise / fall time

理想 PULSE 若 rise / fall time 太小，會造成無限接近垂直的切換邊緣，使 timestep 被迫縮到很小。

Debug 建議：

```text
Rise time = 5 ns ~ 10 ns
Fall time = 5 ns ~ 10 ns
```

跑通後，再逐步降回接近實際 gate driver 的 rise / fall time。

注意事項：

- 邊緣變慢會影響 switching loss。
- Switch node overshoot 與 ringing 也會改變。
- 這是 debug 用設定，不一定能代表最終硬體。

### 外部 gate resistor

若 gate drive 過於理想，可先加入：

```text
Rg = 5 ohm ~ 10 ohm
```

作用：

- 降低 di/dt 與 dv/dt。
- 減少 gate / switch node ringing。
- 避免 timestep 因切換太快而掉到極小。

最終應依照實際設計或 datasheet 建議值調整。

### Gate driver 參考點

對 floating source 或 high-side device，gate driver 的參考點應接到對應 source，而不是固定接地。

建議概念：

```text
Vdrv gate_drv source
```

檢查重點：

- Vgs 是否為真實 gate-to-source 電壓。
- High-side source 飄動時，driver 是否跟著 source 浮動。
- 是否誤把 gate drive 變成 gate-to-ground。

### Gate-source resistor

為避免 gate 浮接，可加入：

```text
Rgs = 100 kohm ~ 1 Mohm
```

作用：

- 幫助 DC operating point。
- 避免 gate 節點無 DC path。
- 降低 floating node 導致的收斂問題。

注意不要設太小，否則會增加 driver loading。

## 電源與啟動條件

### Bus source ramp

理想 bus 在 t = 0 直接跳到高壓，容易造成極大的瞬間電流與 timestep 縮小。

Debug 可改成 ramp：

```text
PWL(0 0 10u Vbus)
```

作用：

- 避免 t = 0 瞬間上電衝擊。
- 幫助 operating point 與 startup 收斂。
- 避免所有非線性元件同時進入劇烈暫態。

注意 startup 行為會被改變，因此若目標是實際上電暫態，仍需使用接近真實條件驗證。

### Bus source 串聯電阻

理想電壓源可提供無限瞬間電流，容易造成不實際的尖峰。

建議先加：

```text
Rbus = 20 mohm ~ 100 mohm
```

作用：

- 限制瞬間電流。
- 讓電源模型較接近實際。
- 改善高頻振盪與收斂。

代價是會產生壓降與損耗，需在結果解讀時納入考量。

### Enable delay / soft-start

若 bus、gate drive、controller、load 在 t = 0 同時啟動，容易造成收斂困難。

建議：

```text
Enable delay = bus ramp 完成後，例如 20 us 後啟動
```

作用：

- 避免所有非線性元件同時動作。
- 讓 power stage 與 controller 啟動順序更容易控制。
- 有助於定位 startup 問題。

## 被動元件非理想化

### 電容 ESR

理想電容容易形成高 Q LC 振盪。

建議大電容加入：

```text
ESR = 10 mohm ~ 100 mohm
```

作用：

- 阻尼高頻 ringing。
- 讓模型更接近真實電容。
- 改善 transient 收斂。

### 電感 DCR

理想電感同樣可能造成高 Q 振盪。

建議：

```text
DCR = 10 mohm ~ 100 mohm
```

或依照 datasheet 的 DCR 設定。

注意 DCR 會影響效率、壓降與電流波形。

### Floating node leakage path

浮接節點會讓 operating point 不易求解。

建議：

```text
Rleak = 10 Mohm ~ 100 Mohm
```

連接到地或合理參考點。

使用時需確認：

- 不會影響高阻抗節點的實際電壓。
- 不會額外產生不合理 leakage。
- 參考點選擇符合實際電路。

## Switch Node Ringing 處理

若 switch node 有嚴重 ringing，除了檢查 layout 寄生參數，也可先加 RC snubber 幫助收斂。

Debug 起始值：

```text
Rsnub = 5 ohm
Csnub = 100 pF
```

作用：

- 阻尼 switch node ringing。
- 降低高頻振盪導致的 timestep 壓縮。
- 改善收斂。

注意 snubber 會增加損耗，最終值需依照實際 ringing 頻率、能量與效率需求調整。

## Ideal 元件處理

理想 switch、理想 diode、理想 voltage source、理想 current source 常是 transient 模擬卡住的來源。

建議：

- Switch 的 Ron 不要設為 0。
- Switch 的 Roff 不要設為無限大。
- Diode 使用合理的 junction capacitance 與 recovery model。
- Voltage source 加入 ramp 或小串聯電阻。
- Current source 避免在 t = 0 瞬間跳變。

目的不是讓模型變差，而是避免不符合實際物理的無限斜率與無限阻抗。

## Comparator 與 Controller

### Comparator hysteresis

若 comparator 在門檻附近高速抖動，可能導致 timestep 被迫縮小。

建議加入小量 hysteresis：

```text
Hysteresis = 依門檻與需求設定
```

作用：

- 避免臨界點附近反覆切換。
- 改善控制訊號穩定性。
- 減少不必要的 transient events。

注意 hysteresis 會改變實際切換門檻，需確認是否符合控制規格。

### Controller 分段加入

建議不要一開始就模擬完整控制器與完整 power stage。

推薦流程：

1. 先確認 power stage 可用固定 duty 或簡化 gate drive 跑通。
2. 再加入 gate driver。
3. 再加入 comparator / PWM。
4. 最後加入完整 controller 與保護機制。

這樣可以快速判斷模擬慢是來自 power stage、gate drive、controller，還是 startup 條件。

## 初始條件

### 電容電壓 .ic

若不需要觀察完整 startup，可用初始條件讓電路接近穩態。

範例：

```text
.ic V(vout)=12
```

作用：

- 縮短等待穩態的模擬時間。
- 避免從不合理初始電壓開始。
- 對長時間 startup 模擬很有幫助。

注意若目標是 startup behavior，就不應用這種方式跳過啟動過程。

### 電感電流 IC

若電感初始電流明顯不合理，也會造成大暫態。

可依預估負載電流設定：

```text
Lout n1 n2 Lvalue IC=Iload_est
```

注意初始電流設錯會造成不真實暫態，因此建議只在 debug 或穩態加速時使用。

## Debug 範例流程

以下是一個常用的 power stage debug 流程：

1. 將 TEMP 設為 25C。
2. 將 bus source 改為 ramp，例如 PWL(0 0 10u Vbus)。
3. 將 enable 延後到 bus 穩定後，例如 20 us。
4. PULSE rise / fall 先設為 5 ns ~ 10 ns。
5. Gate 加入 5 ohm ~ 10 ohm resistor。
6. 電容加入 ESR，電感加入 DCR。
7. Floating node 加入 10 Mohm ~ 100 Mohm leakage path。
8. Integration method 先試 Gear。
9. Relative tolerance 先試 3m，必要時到 5m。
10. 先用較寬鬆設定跑通，再逐步恢復真實參數。

## 最終驗證檢查清單

在 debug 設定跑通後，最終仍需檢查下列項目：

- TEMP 是否已回到實際工作溫度。
- PULSE rise / fall 是否已回到實際 driver 條件。
- Gate resistor 是否符合實際設計。
- Bus ramp 是否符合要分析的 startup 條件。
- ESR / DCR 是否依照 datasheet 或合理估計值。
- RC snubber 是否為實際設計會使用的值。
- Relative tolerance、current tolerance、voltage tolerance 是否已收緊到可接受範圍。
- Max time step 是否足夠捕捉 switching edge、dead time、尖峰與 ringing。
- 使用 Gear 時，是否確認數值阻尼不會掩蓋真正的 overshoot 或 ringing。

## 判斷問題來源的提示

| 現象 | 可能原因 | 優先檢查 |
| --- | --- | --- |
| 一開始 t = 0 就卡住 | Bus 瞬間上電、controller 同時啟動、floating node | Bus ramp、enable delay、leakage path |
| Switching edge 附近卡住 | Rise / fall 太理想、gate loop 太硬、寄生 LC ringing | PULSE rise / fall、gate resistor、ESR / DCR、snubber |
| Switch node ringing 很嚴重 | 理想 LC、高 Q、缺少阻尼 | ESR、DCR、RC snubber、layout parasitic |
| High-side gate 波形異常 | Gate driver 參考點錯誤 | Vgs、driver reference、source node |
| 模擬很慢但可收斂 | Max time step 太小、誤差太嚴格、事件太多 | Max time step、tolerance、controller chattering |
| Comparator 反覆切換 | 門檻附近沒有 hysteresis 或 noise 太大 | Hysteresis、filter、controller model |

## 使用建議

Debug 階段不要一次調整太多項目，否則很難知道是哪個設定真正改善問題。建議每次只調整一到兩個項目，記錄模擬時間、是否收斂、以及主要波形差異。

最推薦的工作方式是建立兩組設定：

- Debug setting：用於快速定位問題與跑通電路。
- Verification setting：用於最終波形、損耗、尖峰與設計判斷。

Debug setting 可以比較寬鬆；Verification setting 必須回到接近真實硬體與合理精度的條件。
