# SIMetrix 操作手冊：Transient 模擬速度與收斂優化

## 目的

本指南用於處理 SIMetrix transient 模擬過慢、`Timestep too small`、switching edge 附近不收斂、DC operating point 找不到、或高頻 ringing 讓模擬卡住的情況。

核心原則：

1. 先確認錯誤類型，再選擇設定。
2. Debug 階段可以用較容易收斂的設定跑通。
3. 最終結果仍要回到接近實際硬體與合理精度的 verification setting。

適用電路包含 switching power stage、GaN / MOSFET half bridge、buck / boost / LLC、gate driver、controller、comparator，以及含 arbitrary source 或 discontinuous behavior 的電源控制模型。

## 先判斷問題類型

| 現象 | 優先處理方向 | 可嘗試設定 |
| --- | --- | --- |
| `No convergence in transient analysis` | 降低數值雜訊、找出不收斂節點 | Extended precision、Advanced iteration、Convergence Report |
| `Cannot find DC operating point` | 補 DC path、避免理想源瞬間衝擊 | leakage resistor、bus ramp、enable delay、Convergence Report |
| `Timestep too small` | 讓模擬器允許更小 timestep，或移除造成極小 timestep 的事件 | 降低 Minimum time step、放慢理想邊緣、加入阻尼 |
| switching edge 附近很慢 | 切換邊緣太硬、寄生 LC ringing、controller 抖動 | gate resistor、ESR/DCR、snubber、Gear、hysteresis |
| 模擬可跑但很慢 | timestep 太細、精度過嚴、事件太多 | 放寬 debug tolerance、簡化控制器、設定初始條件 |

## 建議調整順序

1. 用 `Simulator > Convergence Report` 看是哪個 node/device 常失敗。
2. 若錯誤是 convergence 類，先試 Convergence Dialog 的 Extended precision。
3. 若錯誤是 `Timestep too small`，優先檢查 Minimum time step，而不是把它調大。
4. 檢查理想 source、理想 switch、理想 diode、PULSE rise/fall 是否太硬。
5. 加入必要 ESR、DCR、gate resistor、leakage path 或 snubber。
6. 將 bus ramp、enable、soft-start 分開，不要所有非線性元件在 t = 0 同時動作。
7. 跑通後逐步恢復實際參數，最後用 verification setting 重新確認波形、尖峰、損耗與效率。

## Choose Analysis：Options 頁籤

Options 頁籤主要控制全域精度、電路初始條件與輸出內容。這些設定會影響 DC 與 transient 的收斂，也會影響模擬速度。官方 Simulator Reference 說明，放寬 tolerance 可提升速度但會犧牲精度；SIMetrix 也提供 POINTTOL 等機制讓大訊號 power circuit 不必一開始就大幅放寬所有 tolerance。

### Relative tolerance

用途：控制 DC/transient 的相對精度。提高 RELTOL 通常能讓模擬變快，也可能改善收斂，但精度會下降。

何時使用：

- 只是先確認電源轉換器能否進入穩態。
- 波形大方向比小 ripple、尖峰精度更重要。
- 模擬很慢且沒有明確不收斂節點。

簡單例子：

- 1 MHz buck 只想先確認 soft-start 是否能到 12 V，可把 relative tolerance 從 `1m` 暫時放寬到 `3m`。
- 最終量測 overshoot、dead time 或 loss 時，再回到 `1m` 或更嚴格設定。

### Current tolerance

用途：控制絕對電流誤差。Power stage 是 A 等級電流時，pA 等級預設可能太嚴，放寬可改善速度與收斂。

何時使用：

- 大電流 MOSFET、diode、inductor 電流切換。
- 模擬卡在很小的殘餘電流誤差。

簡單例子：

- 20 A buck 在 diode reverse recovery 後的尾端電流反覆迭代，可先把 current tolerance 從 `1p` 試到 `10p` 或 `100p`。
- 若你正在看 standby leakage 或 nA bias current，就不要放寬到 `1n`。

### Voltage tolerance

用途：控制絕對電壓誤差。放寬可減少微伏級誤差造成的迭代，但會影響小訊號與低 ripple 判斷。

何時使用：

- power node 是數 V 到數百 V，debug 階段不關心 uV 級差異。
- 控制迴路或 switch node 大方向確認。

簡單例子：

- 400 V bus half bridge 只想先看 gate timing，可把 voltage tolerance 從 `1u` 試到 `10u`。
- 若正在看 op amp offset、微小 ripple 或 noise，應維持較嚴格。

### Temperature

用途：指定模擬溫度。高溫會改變 semiconductor model、leakage 與導通特性，可能使收斂變難。

何時使用：

- Debug 時先排除高溫模型造成的不穩。
- 跑通後再回到實際溫度角落。

簡單例子：

- 120C MOSFET model transient 不收斂，可先用 `25C` 跑通，確認是電路連接或模型設定問題，再回到 `120C` 做 verification。

### Initial condition force resistance

用途：在求初始條件時提供一個 force resistance，幫助初始狀態收斂。這類設定可能改變初始 operating point 的求解方式，需只作 debug。

何時使用：

- DC operating point 很難找。
- 電容初始電壓、浮接節點或高阻節點讓啟動點不穩。

簡單例子：

- boost converter 的 output cap 有 `.ic V(out)=48`，但 DCOP 不穩，可先設定 initial condition force resistance 讓初始條件更容易被套用；跑通後檢查 startup 波形是否仍合理。

### List file output：Parameters 與 Expand subcircuits

用途：控制 list file 輸出內容。這不會直接加速電路求解，但會影響 debug 能見度與輸出量。

何時使用：

- 想確認 parameter 是否真的被套用。
- 子電路太多，需要展開檢查 model 內部是否有不合理值。

簡單例子：

- 懷疑 gate resistor parameter 沒傳進 MOSFET driver subcircuit，可把 Parameters 設為輸出 given/all，必要時勾 Expand subcircuits 看 netlist 展開結果。

### Monte Carlo seed / Sensitivity / Worst-case

用途：用於 Monte Carlo、sensitivity、worst-case 類分析。這些通常會增加模擬次數，不是 transient 加速選項。

何時使用：

- 單次 transient 已穩定後，才開啟 corner、worst-case 或統計分析。

簡單例子：

- 先用單一 typical case 調好 convergence，再啟用 Monte Carlo。不要在還會 `Timestep too small` 時直接跑 100 次 Monte Carlo。

### Verilog-HDL timing resolution

用途：控制 Verilog simulator 的 timing resolution。解析度越細，mixed-signal event 可能越多，速度可能變慢。

何時使用：

- 電路含 Verilog-HDL 或 mixed-signal 數位事件。
- 數位 timing 不需要 fs 等級精度時，可放寬解析度。

簡單例子：

- PWM controller 的 digital timing 只需要 ns 等級，可把 timing resolution 從 `1fs` 改成 `1ps` 或 `1ns` 測試速度差異；若 dead-time 是 5 ns，解析度仍需足夠小到能辨識 dead-time。

## Choose Analysis：Transient 頁籤

Transient 頁籤決定模擬時間、資料輸出範圍與是否做 multi-step。很多「感覺很慢」其實不是求解慢，而是 stop time 太長或輸出資料太多。

### Stop time

用途：設定 transient 模擬結束時間。越長越慢，尤其 switching power supply 會累積大量週期。

何時使用：

- 只跑到需要觀察的事件結束。
- 先用短時間 debug，再延長到完整 startup 或 steady-state。

簡單例子：

- 500 kHz buck 的週期是 2 us。若只想看前 20 個 switching cycles，stop time 可先設 `40u`，不要一開始就設 `1m`。

### Start data output @

用途：延後開始儲存波形資料。這可以減少輸出檔與波形處理時間，但不會減少前段求解時間。

何時使用：

- startup 前段不需要看，只關心接近穩態的波形。
- 長時間模擬造成 waveform viewer 很慢。

簡單例子：

- LLC 需要 2 ms 才接近穩態，但只想看 2 ms 到 2.2 ms 的 ripple，可設 stop time `2.2m`，Start data output @ `2m`。

### .PRINT step

用途：指定 `.PRINT` 或等距輸出間隔。若選擇只在 `.PRINT step` 輸出，資料量會大幅下降，但會失去中間細節。

何時使用：

- 只需要慢變趨勢、平均值、啟動包絡線。
- 不需要檢查每個 switching edge。

簡單例子：

- soft-start 需要 10 ms，只想看 Vout 包絡線，可用 `.PRINT step = 10u`。若要看 20 ns dead time，不能只靠 10 us print step。

### Output all data / Output at .PRINT step

用途：選擇保存所有 solver time points，或只保存指定 print step。

何時使用：

- `Output all data`：要看 switching edge、尖峰、ringing、dead time。
- `Output at .PRINT step`：只看慢速 startup、thermal-like trend、平均包絡線。

簡單例子：

- Debug convergence 時先用 `Output at .PRINT step` 加速資料處理；確認 switch node spike 時改回 `Output all data`。

### Real time noise

用途：啟用 time-domain noise。這會增加模擬負擔，通常不是加速選項。

何時使用：

- 需要觀察 noise 對 comparator、jitter、低雜訊放大器或 ADC threshold 的影響。

簡單例子：

- 若只是 debug buck startup，不要勾 real-time noise。等 power stage 已穩定後，再開 noise 看 comparator 是否誤觸發。

### Enable multi-step

用途：對參數做多組 sweep。這會把 transient 跑多次，不會讓單次模擬更快。

何時使用：

- 單一 case 已能穩定收斂後，用來比較 Rg、snubber、load、temperature。

簡單例子：

- 先確認 Rg = 5 ohm 能跑完，再 multi-step Rg = 2/5/10 ohm 比較 loss。不要在 base case 尚未收斂前就開 multi-step。

### Define Snapshots

用途：保存或使用中間狀態，方便從某個狀態繼續分析，避免每次都從 t = 0 重跑。

何時使用：

- startup 很長，但你常常只改後段負載或控制條件。

簡單例子：

- 先跑到 Vout 穩態並建立 snapshot，之後測 load step 時從穩態 snapshot 開始，不必每次重跑完整 soft-start。

## Transient Advanced Options

Advanced Options 是 transient 加速與收斂最常用的設定頁，尤其是 max/min timestep、integration method、skip DC bias point 與 fast start。

### Max time step

用途：限制 solver 最大 timestep。官方手冊說明 SIMetrix 會自行選 timestep，但不會超過這個值。

何時使用：

- 需要捕捉 switching edge、dead time、spike、ringing。
- 太大會漏掉快速事件；太小會明顯變慢。

簡單例子：

- 1 MHz switching，週期 1 us。初步可設 `Max time step = 20n` 到 `5n`。若要看 10 ns dead time，Max time step 應小於 dead time 的一部分，例如 `1n` 到 `2n`。

### Min time step

用途：設定 solver 可使用的最小 timestep。官方說明，如果需要比此值更小的 timestep，模擬會 abort；遇到 `Timestep too small` 時，降低此值可能有幫助，提高它不會提升速度。

何時使用：

- 錯誤訊息明確是 `Timestep too small`。
- 使用 quad/extended precision 時還需要更小 timestep 來通過特定事件。

簡單例子：

- Min time step 預設 `1E-18`，模擬仍報 `Timestep too small`，可嘗試 `1E-20` 來確認是否只是下限擋住。若成功，仍要回頭檢查是哪個 source 或 ringing 造成極小 timestep。

### Integration method：Trapezoidal / Gear

用途：選擇 reactive element 的數值積分方式。官方說明 Gear 可改善某些 unexplained triangular ringing，但對 resonant circuit 會有數值阻尼，強諧振電路應使用 Trapezoidal。

何時使用：

- `Trapezoidal`：一般預設、諧振槽、oscillator、需要準確 ringing。
- `Gear`：switching transient 有數值振盪、理想 LC 造成不穩、先求跑通。

簡單例子：

- Half bridge switch node 有不合理鋸齒狀數值振盪，可先改 Gear 確認是否為數值問題。
- LLC resonant tank 要看實際諧振波形時，不應長期用 Gear 當最終結果。

### Skip DC bias point

用途：跳過 DC operating point，讓 transient 從所有 node 近似 0 V 開始。官方手冊提醒，除非所有 voltage/current source 在 t = 0 都是 0，否則可能更容易不收斂。

何時使用：

- 電路本來就是從完全斷電啟動。
- 所有 source 都有 PWL/ramp，t = 0 為 0。
- DCOP 因 switching controller 或 latch 狀態難以求解，但 transient startup 是合理路徑。

簡單例子：

- Bus source 是 `PWL(0 0 10u 400)`、enable 在 20 us 才啟動，可試 Skip DC bias point。
- 若有一個 400 V ideal DC source 在 t = 0 已經是 400 V，勾 Skip DC bias point 可能造成瞬間衝擊與不收斂。

### Fast start

用途：在指定時間內放寬 transient 精度，加速找到 steady state。官方手冊說明，這會犧牲 fast start 期間的精度；到穩態後通常仍需一段 settling time。

何時使用：

- 你不關心 startup 細節，只想快速進入穩態。
- oscillator 或 switching power supply 需要跑很多週期才穩定。

簡單例子：

- Buck 需要 1 ms 才穩態，但你只關心 1 ms 後的 ripple，可設 Fast start `800u`，再從 800 us 到 1 ms 留 settling time，最後只分析 1 ms 後波形。

## Convergence Dialog 使用方式

開啟方式：`Simulator > Convergence Options`。

SIMetrix 官方文件說明，這個 dialog 是用來設定可幫助 convergence 的模擬選項，但部分選項會降低速度或影響精度。因此它適合用於 debug、定位問題、救援不收斂模擬，不應直接取代最終驗證設定。

### Iteration mode

| 選項 | 何時使用 | 對速度與精度的影響 |
| --- | --- | --- |
| Normal mode | 預設最快；電路已可穩定收斂時使用 | 最快，但遇到數值雜訊可能較容易失敗 |
| Advanced iteration | Normal 不穩但不想大幅變慢時先試 | 官方說明約小幅增加時間，可降低數值雜訊 |
| Extended precision | transient 不收斂、switching edge 失敗、round-off noise 疑似主因時優先嘗試 | 官方建議值得先試，通常只有 modest speed loss |
| Extended/quad precision | Extended precision 仍失敗，且錯誤集中在極小 timestep 或高動態範圍節點時使用 | 可能慢很多，適合救援與定位，不適合作為長期預設 |
| Full quad precision | 其他模式都失敗，且需要確認是否為數值精度極限時才用 | 最慢，只建議短時間 debug |

使用建議：

- 第一個可嘗試的救援設定是 `Extended precision`。
- 如果 Extended precision 能跑通，再回頭處理造成不收斂的實際電路原因。
- Quad 類模式可能讓模擬慢很多；用於確認問題，不建議直接拿來跑完整長時間 sweep。

### Tolerances：Absolute current

官方文件指出 current tolerance 預設為 1 pA，有些電路設到 1 nA 可解 convergence 問題，但若電路含非常小的電流，不應調大。

適合使用：

- power stage 電流是 A 等級，但模擬器卡在 pA 等級誤差。
- 大電流切換電路在低電流尾端反覆迭代。
- 目標是先讓 transient 跑通，而不是量測 leakage。

不適合使用：

- leakage current、bias current、nA 或 pA 等級電流是設計重點。
- offset、standby current、保護電路微小電流需要準確判斷。

建議：

- Debug 可先試 `10 pA` 到 `100 pA`。
- 若仍不收斂，再短暫試 `1 nA`。
- 最終 verification 應回到可接受的電流精度。

### Time step：Minimum

官方文件說明，`Timestep too small` 不是一般 convergence error，而是電路要求比允許下限更小的 timestep；此時可降低 Minimum time step。提高 Minimum time step 不會加速模擬，反而可能讓模擬更早 abort。

適合使用：

- 錯誤訊息明確出現 `Timestep too small`。
- 使用 Extended/quad precision 後仍卡在極小 timestep。
- 想確認是否只是 minimum timestep 下限擋住模擬。

不適合使用：

- 想用提高 minimum timestep 來加速。
- switching edge、ringing 或 discontinuity 本身仍不合理。

建議：

- 一般維持 Default。
- 若遇到 `Timestep too small`，可嘗試比 default 更小的值。
- 若 lowered minimum timestep 讓模擬跑完，仍要回頭找出是哪個 node、source 或 model 逼出極小 timestep。

### Slew rate for discontinuous sources

這項是替 arbitrary source 的不連續跳變加上有限 slew rate。官方文件指出它只對含 discontinuous source 的模型有效，這類來源常見於 switching power controller。

適合使用：

- Convergence Static Audit 或模型內容顯示有 `IF(expression, constant, constant)`、`SGN()`、`STP()`、`floor()` 類不連續式。
- controller、comparator、PWM、保護邏輯模型在門檻附近瞬間跳變。
- 模擬卡在控制訊號切換點，而不是 power device 本身。

不適合使用：

- 電路沒有 arbitrary behavioral source。
- 你正在驗證控制訊號真實 propagation delay 或 sharp edge 行為。

建議：

- 先用 `1e12` V/s 或依訊號量級換算成合理 rise/fall time。
- 若模擬改善，代表模型 discontinuity 是主要問題；後續應用 hysteresis、transition function 或更物理的 behavioral model 修正。

### Circuit modifiers：Shunt capacitance

Shunt capacitance 會從所有 top-level node 加小電容到 ground。官方文件說明它常能改善 transient convergence，`Apply shunt capacitance globally` 可能更有效，但這等於修改電路，必須小心使用，而且只幫助 transient analysis。

適合使用：

- 浮動節點、超高阻節點或理想 source 造成 transient 不穩。
- 數位/行為模型產生很硬的電壓跳變。
- 只想先定位是哪個區塊導致不收斂。

不適合使用：

- RF、高 Q resonant、oscillator、精準 ringing、switch-node spike 或小電容敏感電路。
- 你要量測的波形本來就受 pF/fF 等級寄生電容影響。

建議：

- 先從很小值開始，例如 `1 fF`。
- 不要一開始勾 `Apply shunt capacitance globally`；只在局部 shunt 無效且需要快速定位時短暫使用。
- 若使用後模擬變快或跑通，需檢查這個電容是否改變 ringing、delay、overshoot 或 switching loss。

### Circuit modifiers：Inductor loss TC

這項會對所有電感加入電阻，電阻值為 `L/TC`。截圖中的說明指出很小的值，例如 1 fs，在部分電路可幫助 convergence。

適合使用：

- 理想電感造成高 Q LC 振盪。
- switch node 或 resonant tank 因缺少阻尼而讓 timestep 持續縮小。
- 只是 debug 收斂，尚未加入實際 DCR。

不適合使用：

- LLC、諧振槽、振盪器、濾波器 Q 值本身是觀察重點。
- 電感 DCR 已依 datasheet 正確建模。

建議：

- 優先手動在關鍵電感加入 datasheet DCR。
- 只有在不知道是哪顆理想電感造成問題時，短暫用此選項定位。
- 跑通後應改回明確 DCR，而不是長期依賴全域 inductor loss。

## 電路修改清單

| 類別 | 建議起始值 | 用途 | 注意 |
| --- | --- | --- | --- |
| PULSE rise/fall | 5 ns 到 10 ns | 避免理想瞬間切換 | 會改變 switching loss 與 spike |
| Gate resistor | 5 ohm 到 10 ohm | 降低 di/dt、dv/dt 與 ringing | 最終應回到實際 Rg |
| Gate-source resistor | 100 kohm 到 1 Mohm | 避免 gate 浮接 | 太小會增加 driver loading |
| Bus ramp | 例如 PWL 0 到 Vbus 於 10 us | 避免 t = 0 高壓瞬間上電 | startup 行為會改變 |
| Bus source series R | 20 mohm 到 100 mohm | 避免理想源無限瞬間電流 | 會造成壓降與損耗 |
| Capacitor ESR | 10 mohm 到 100 mohm | 阻尼高 Q LC | 影響 ripple 與損耗 |
| Inductor DCR | 依 datasheet 或 10 mohm 到 100 mohm | 讓電感更接近實體 | 影響效率與電流 |
| Leakage path | 10 Mohm 到 100 Mohm | 給 floating node DC path | 高阻節點需確認誤差 |
| RC snubber | 例 5 ohm + 100 pF | 阻尼 switch node ringing | 會增加損耗 |
| Comparator hysteresis | 依門檻加小量回授 | 避免門檻附近抖動 | 會改變切換門檻 |

## 快速 debug 流程

1. 先看 Convergence Report，找失敗 node/device。
2. 將 TEMP 暫設 25C，排除高溫模型造成的額外難度。
3. 將 bus 改成 ramp，enable 延後到 bus 穩定後。
4. PULSE rise/fall 先設 5 ns 到 10 ns，gate 加入 5 ohm 到 10 ohm。
5. 電容加入 ESR，電感加入 DCR，floating node 加 leakage path。
6. 若仍不收斂，開 Convergence Dialog，先試 Extended precision。
7. 若錯誤是 `Timestep too small`，嘗試降低 Minimum time step。
8. 若模型有 discontinuous source，設定 finite slew rate。
9. 若仍卡在理想 LC 或 floating node，短暫試 shunt capacitance 或 inductor loss TC。
10. 跑通後逐步撤回 debug-only 設定，確認哪個設定真正必要。

## 最終驗證檢查清單

- TEMP 是否回到實際工作溫度。
- rise/fall、gate resistor、bus ramp、enable delay 是否符合實際設計。
- ESR、DCR、snubber、leakage path 是否為實際或合理估計值。
- Convergence Dialog 的 shunt capacitance、global shunt、inductor loss TC 是否已撤回或改成明確元件。
- tolerance 是否回到可接受精度。
- Gear 或 Extended/quad precision 是否只作為 debug 輔助，而非掩蓋真實 ringing 或模型問題。
- 重要波形需重新確認：Vgs、Vds、switch node spike、dead time、reverse recovery、平均損耗與峰值電流。

## 官方依據

- SIMetrix User Manual: Convergence，說明 `Simulator > Convergence Options`、iteration mode、current tolerance、minimum time step、discontinuous source slew rate、shunt capacitance，以及 Convergence Report / Static Audit。
- SIMetrix Simulator Reference: Transient Analysis - `Timestep too small` Error，說明 `Timestep too small` 代表需要比 minimum permissible 更小的 timestep，降低 minimum timestep 可解此錯誤。
- SIMetrix Simulator Reference: Accuracy and Integration Methods，說明 RELTOL、POINTTOL、ABSTOL、VNTOL、TRTOL 與 Gear integration 的速度、精度與數值阻尼取捨。
