# SIMPLIS C-Code DLL 數位補償器撰寫流程

這份筆記整理如何用 SIMetrix/SIMPLIS 的 C-code DLL，把 Type I、Type II、Type III 類比補償器改寫成數位控制器，並放回轉換器模擬中使用。

## 1. 基本概念

C-code DLL 的用途是把 C/C++ 寫成的數位控制邏輯編譯成 Windows DLL，讓 SIMPLIS 在模擬時呼叫。

以電源轉換器來說，典型架構如下：

```text
Vout / Iout
  -> ADC 或取樣電路
  -> C-code DLL digital compensator
  -> duty command / PWM command
  -> DPWM / gate driver
  -> power stage
```

也就是：

```text
功率級仍然用 SIMPLIS 電路模型
補償器改成 C 裡面的數位差分方程
```

## 2. 先決定 DLL 補償器介面

以 buck converter 的數位補償器為例，可以先定義以下 pins。

### Inputs

```text
CLK      控制器更新時脈
RESET    重置訊號，可選
VFB      回授電壓，通常來自 ADC 或數位 bus
VREF     參考電壓，可用 input bus 或 parameter
```

### Outputs

```text
DUTY     duty command，輸出給 DPWM
```

### Parameters

```text
B0
B1
B2
A1
A2
DUTY_MIN
DUTY_MAX
INITIAL_DUTY
OUTPUT_DELAY
```

Type I 或 Type II 不一定會用到全部係數，但可以保留同一組介面，讓同一個 DLL 支援多種補償器。

## 3. 在 SIMPLIS 產生 C-code DLL 專案

建議不要從空白 C 檔開始寫，而是從 SIMPLIS 內建的 C-code DLL project generator 產生範例專案。

一般流程：

```text
C-Code DLL
  -> New C-Code DLL Project Definition
```

接著設定：

```text
Device name
Version
Input buses
Output buses
Parameters
```

設定完成後：

```text
Save & Create C/C++ Source
```

SIMPLIS 會產生 Visual Studio 專案與 C source files。

常見檔案會包含：

```text
project_name.vcxproj
smx_dll.h
project_name.h
project_name_setup.c
project_name_set_initial_condition.c
project_name_action.c
project_name_teardown.c
```

實際補償器演算法通常寫在：

```text
project_name_action.c
```

## 4. DLL device 的主要函數

SIMPLIS DLL-defined digital device 通常會有幾個主要階段：

```text
setup
set_initial_condition
action
teardown
```

用途大致如下：

```text
setup                  初始化資料結構、讀取參數
set_initial_condition  設定初始狀態
action                 每次事件或 clock 觸發時執行主要邏輯
teardown               模擬結束時釋放資源
```

補償器的差分方程主要放在 `action` 裡。

## 5. 類比補償器轉數位補償器

流程是：

```text
類比補償器 Gc(s)
  -> 選取取樣頻率 fs
  -> 用 Tustin / Bilinear Transform 轉成 Gc(z)
  -> 得到 IIR coefficients
  -> 寫成 C 差分方程
```

常用轉換式：

```text
s = (2 / Ts) * (1 - z^-1) / (1 + z^-1)
```

其中：

```text
Ts = 1 / fs
```

對 switching converter 來說，常見設定是：

```text
fs = fsw
```

也就是每個 switching cycle 更新一次控制器。

## 6. Type I 數位補償器

類比 Type I 基本上是積分器：

```text
Gc(s) = K / s
```

數位差分方程可寫成：

```text
u[n] = u[n-1] + Ki * e[n]
```

其中：

```text
e[n] = Vref - Vfb[n]
u[n] = duty command
```

C code 概念：

```c
typedef struct {
    double ki;
    double u;
    double u_min;
    double u_max;
} TypeIComp;

static double clamp(double x, double xmin, double xmax) {
    if (x > xmax) return xmax;
    if (x < xmin) return xmin;
    return x;
}

double type_i_step(TypeIComp *c, double vref, double vfb) {
    double e = vref - vfb;

    c->u += c->ki * e;
    c->u = clamp(c->u, c->u_min, c->u_max);

    return c->u;
}
```

## 7. Type II 數位補償器

常見 Type II 類比形式：

```text
Gc(s) = K * (1 + s / wz) / [s * (1 + s / wp)]
```

它包含：

```text
1 個 integrator
1 個 zero
1 個 high-frequency pole
```

數位化後可寫成：

```text
u[n] = a1 * u[n-1] + b0 * e[n] + b1 * e[n-1]
```

C code 概念：

```c
typedef struct {
    double a1;
    double b0;
    double b1;
    double e1;
    double u1;
    double u_min;
    double u_max;
} TypeIIComp;

double type_ii_step(TypeIIComp *c, double vref, double vfb) {
    double e0 = vref - vfb;

    double u0 = c->a1 * c->u1
              + c->b0 * e0
              + c->b1 * c->e1;

    u0 = clamp(u0, c->u_min, c->u_max);

    c->e1 = e0;
    c->u1 = u0;

    return u0;
}
```

## 8. Type III 數位補償器

常見 Type III 類比形式：

```text
Gc(s) = K * (1 + s / wz1)(1 + s / wz2)
        / [s * (1 + s / wp1)(1 + s / wp2)]
```

它包含：

```text
1 個 integrator
2 個 zeros
2 個 poles
```

數位化後常寫成二階 IIR：

```text
u[n] = b0 * e[n] + b1 * e[n-1] + b2 * e[n-2]
     - a1 * u[n-1] - a2 * u[n-2]
```

C code 概念：

```c
typedef struct {
    double b0;
    double b1;
    double b2;
    double a1;
    double a2;
    double e1;
    double e2;
    double u1;
    double u2;
    double u_min;
    double u_max;
} TypeIIIComp;

double type_iii_step(TypeIIIComp *c, double vref, double vfb) {
    double e0 = vref - vfb;

    double u0 = c->b0 * e0
              + c->b1 * c->e1
              + c->b2 * c->e2
              - c->a1 * c->u1
              - c->a2 * c->u2;

    u0 = clamp(u0, c->u_min, c->u_max);

    c->e2 = c->e1;
    c->e1 = e0;
    c->u2 = c->u1;
    c->u1 = u0;

    return u0;
}
```

## 9. 用同一個二階 IIR 支援 Type I、Type II、Type III

實務上可以直接用 Type III 的二階 IIR 架構作為通用補償器：

```text
u[n] = b0 * e[n] + b1 * e[n-1] + b2 * e[n-2]
     - a1 * u[n-1] - a2 * u[n-2]
```

Type I、Type II 只是係數比較簡單。

例如：

```text
Type I:
  b0 = Ki
  b1 = 0
  b2 = 0
  a1 = -1
  a2 = 0

Type II:
  使用 b0, b1, a1
  b2 = 0
  a2 = 0

Type III:
  使用 b0, b1, b2, a1, a2
```

注意：實際係數符號要和你採用的差分方程格式一致。不同工具匯出的 `a1`, `a2` 符號定義可能不同。

## 10. 在 action function 中做的事

在 SIMPLIS 產生的 `project_name_action.c` 裡，通常要做以下工作：

```text
1. 偵測 CLK 上升緣
2. 讀取 VFB input bus
3. 讀取 VREF input bus 或 parameter
4. 讀取 b0, b1, b2, a1, a2 等 parameters
5. 計算 e[n] = Vref - Vfb
6. 執行差分方程
7. 做 duty clamp
8. 將 duty 轉成整數 code
9. 寫入 DUTY output bus
10. 設定 output delay
```

概念流程：

```c
if (rising_edge_clk) {
    double vfb = read_vfb_bus();
    double vref = read_vref();

    double duty = type_iii_step(&state, vref, vfb);

    int duty_code = duty_to_code(duty);

    write_duty_bus(duty_code);
}
```

`read_vfb_bus()`、`write_duty_bus()` 這類函數名稱只是示意，實際名稱要依 SIMPLIS 產生的範例與 `smx_dll.h` 為準。

## 11. Duty limit 與 anti-windup

實際控制器一定要限制 duty：

```text
DUTY_MIN <= duty <= DUTY_MAX
```

例如：

```text
DUTY_MIN = 0.02
DUTY_MAX = 0.95
```

如果補償器含 integrator，還要考慮 anti-windup，避免 duty 飽和後積分器繼續累積。

簡化 anti-windup 概念：

```c
double proposed_u = calculate_next_output();
double limited_u = clamp(proposed_u, duty_min, duty_max);

if (proposed_u == limited_u) {
    update_integrator_state();
}
```

也就是輸出沒有被飽和時才更新積分狀態。

## 12. 編譯 DLL

用 Visual Studio 開啟 SIMPLIS 產生的 `.vcxproj`。

建議設定：

```text
Configuration: Release
Platform: x64 或 Win32
```

平台位元數要和 SIMetrix/SIMPLIS 使用的版本相容。

編譯完成後會得到：

```text
project_name.dll
```

## 13. 在 SIMPLIS 中載入 DLL

回到 SIMetrix/SIMPLIS：

```text
C-Code DLL
  -> Construct C-Code DLL Symbol
```

選擇剛剛編譯出的 DLL。

SIMPLIS 會依 DLL device definition 建立 schematic symbol 與參數編輯視窗。

接著把 symbol 放進轉換器 schematic。

## 14. 與轉換器連接

典型連接方式：

```text
Vout
  -> voltage sensing
  -> ADC / quantizer
  -> VFB bus
  -> C-code DLL compensator
  -> DUTY bus
  -> DPWM
  -> gate driver
  -> MOSFET
  -> LC output stage
```

補償器應該在固定控制週期更新，例如：

```text
fsw = 500 kHz
Ts = 2 us
```

也就是每 `2 us` 的 clock 上升緣更新一次 duty。

不要讓補償器在每個 analog timestep 都重新計算，否則會不像真實數位控制器。

## 15. 驗證流程

建議分階段驗證：

```text
1. 先固定 VFB，確認 DUTY 輸出正確
2. 接入簡單 DPWM，確認 duty code 能轉成 PWM
3. 接入 open-loop power stage
4. 接入 closed-loop converter
5. 做 transient startup
6. 做 load transient
7. 做 line transient
8. 做 POP / periodic operating point
9. 做 AC loop gain
10. 做 Monte Carlo / Multi-Step
```

第一版建議先做 Type I，確認 DLL 可以正常讀 input 與寫 output。

接著再升級成 Type II。

最後再用同一個二階 IIR 結構實作 Type III。

## 16. 常見注意事項

### 取樣延遲

數位控制通常會有：

```text
ADC delay
calculation delay
PWM update delay
```

這些延遲會降低 phase margin。

常見保守設計：

```text
fc < fsw / 10
```

更保守可以用：

```text
fc < fsw / 20
```

### 量化效應

如果要更接近真實控制 IC，應加入：

```text
ADC resolution
DPWM resolution
coefficient quantization
duty quantization
```

### 初始條件

模擬 startup 時要設定：

```text
initial duty
initial integrator state
soft-start state
```

否則閉迴路可能一開始進入不合理狀態。

### 係數符號

不同工具輸出的 IIR 係數格式可能不同。

例如有些工具寫成：

```text
y[n] = b0*x[n] + b1*x[n-1] + b2*x[n-2]
     - a1*y[n-1] - a2*y[n-2]
```

有些工具則把負號吸收到 `a1`, `a2` 內。

使用前一定要確認差分方程格式一致。

## 17. 建議開發順序

最穩定的開發順序：

```text
1. 用 SIMPLIS generator 產生 DLL project
2. 建立最簡單的 pass-through DLL
3. 確認 input bus / output bus 正常
4. 加入 Type I 補償器
5. 加入 duty clamp
6. 加入 Type II 係數
7. 加入 Type III 係數
8. 加入 anti-windup
9. 加入 ADC / DPWM 量化
10. 加入 soft-start / fault logic
```

不要第一版就把所有功能放進去。先讓 DLL 能穩定地讀取回授、輸出 duty，再逐步增加真實控制器細節。

## 18. 一句話總結

用 C-code DLL 寫 Type I / Type II / Type III 補償器，本質上是：

```text
把類比補償器 Gc(s)
轉成數位補償器 Gc(z)
再用 C 的差分方程在 SIMPLIS 裡每個 clock 週期執行一次
```

最後輸出 duty command 給 DPWM，完成數位控制轉換器模型。
