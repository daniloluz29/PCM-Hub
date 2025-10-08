import React, { useState, useEffect, useRef } from "react";

const Calculadora = ({ onClose }) => {
  const [displayValue, setDisplayValue] = useState("0");
  const [firstOperand, setFirstOperand] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForSecondOperand, setWaitingForSecondOperand] = useState(false);
  const [expression, setExpression] = useState("");
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const calcRef = useRef(null);
  const [position, setPosition] = useState({
    x: window.innerWidth / 2 - 150,
    y: window.innerHeight / 2 - 200,
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleNumberInput = (digit) => {
    if (waitingForSecondOperand) {
      setDisplayValue(String(digit));
      setWaitingForSecondOperand(false);
    } else {
      setDisplayValue(displayValue === "0" ? String(digit) : displayValue + digit);
    }
    setExpression((prev) => prev + digit);
  };

  const handleDecimal = () => {
    if (!displayValue.includes(".")) {
      setDisplayValue(displayValue + ".");
      setExpression((prev) => prev + ".");
    }
  };

  const performCalculation = () => {
    const inputValue = parseFloat(displayValue);
    const prevValue = firstOperand;

    let result = inputValue;
    if (operator === "+") result = prevValue + inputValue;
    if (operator === "-") result = prevValue - inputValue;
    if (operator === "*") result = prevValue * inputValue;
    if (operator === "/") result = prevValue / inputValue;
    if (operator === "%") result = (prevValue * inputValue) / 100;

    return result;
  };

  const handleOperator = (nextOperator) => {
    const inputValue = parseFloat(displayValue);

    if (operator && waitingForSecondOperand) {
      setOperator(nextOperator);
      setExpression((prev) => prev.slice(0, -1) + nextOperator);
      return;
    }

    if (firstOperand === null) {
      setFirstOperand(inputValue);
    } else if (operator) {
      const result = performCalculation();
      saveToHistory(`${expression} = ${result}`);
      setDisplayValue(String(result));
      setFirstOperand(result);
    }

    setWaitingForSecondOperand(true);
    setOperator(nextOperator);
    setExpression((prev) => prev + nextOperator);
  };

  const handleEquals = () => {
    if (operator && !waitingForSecondOperand) {
      const result = performCalculation();
      saveToHistory(`${expression} = ${result}`);
      setDisplayValue(String(result));
      setFirstOperand(null);
      setOperator(null);
      setWaitingForSecondOperand(true);
      setExpression("");
    }
  };

  const handleClear = () => {
    setDisplayValue("0");
    setFirstOperand(null);
    setOperator(null);
    setWaitingForSecondOperand(false);
    setExpression("");
  };

  const saveToHistory = (entry) => {
    setHistory((prev) => [entry, ...prev]);
  };

  const handleHistoryClick = (item) => {
    const resultString = item.split("= ")[1];
    const resultValue = parseFloat(resultString);

    if (isNaN(resultValue)) return;

    setDisplayValue(resultString);
    setExpression(resultString);
    setFirstOperand(resultValue);
    setOperator(null);
    setWaitingForSecondOperand(true);
    setShowHistory(false);
    
    // Devolve o foco para a calculadora
    if (calcRef.current) {
        calcRef.current.focus();
    }
  };

  // ==== Lógica de Arrastar (Drag) ====
  const onMouseDown = (e) => {
    if (e.target.className.includes("calculator-header")) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const onMouseMove = (e) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const onMouseUp = () => setIsDragging(false);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isDragging, dragStart]);

  // ==== Foco e Eventos de Teclado ====
  useEffect(() => {
    if (calcRef.current) {
      calcRef.current.focus();
    }
  }, []);

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (!isNaN(e.key) && e.key.trim() !== '') handleNumberInput(e.key);
    else if (e.key === ".") handleDecimal();
    else if (["+", "-", "*", "/"].includes(e.key)) handleOperator(e.key);
    else if (e.key === "%") handleOperator("%");
    else if (e.key === "Enter" || e.key === "=") {
        e.preventDefault();
        handleEquals();
    }
    else if (e.key === "Backspace") setDisplayValue(displayValue.slice(0, -1) || "0");
    else if (e.key === "Escape" || e.key.toLowerCase() === 'c') handleClear();
  };

  // Impede que os botões recebam foco ao serem clicados
  const preventButtonFocus = (e) => {
    e.preventDefault();
  };


  // ==== Renderização ====
  return (
    <div
      className="calculator-wrapper"
      style={{ top: `${position.y}px`, left: `${position.x}px` }}
      ref={calcRef}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="calculator-modal"
      >
        <div className="calculator-header" onMouseDown={onMouseDown}>
          <span>Calculadora</span>
          <div className="calculator-header-buttons">
            <button
              className="history-btn"
              onMouseDown={preventButtonFocus}
              onClick={() => setShowHistory((s) => !s)}
              title="Histórico"
            >
              <i className="bi bi-clock-history"></i>
            </button>
            <button className="close-btn" onMouseDown={preventButtonFocus} onClick={onClose}>
              &times;
            </button>
          </div>
        </div>
        <div className="calculator-expression">{expression}</div>
        <div className="calculator-display">{displayValue}</div>
        <div className="calculator-buttons">
          <button onMouseDown={preventButtonFocus} onClick={handleClear} className="limp">
            AC
          </button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleOperator("%")} className="operator">
            %
          </button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleOperator("/")} className="operator">
            ÷
          </button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(7)}>7</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(8)}>8</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(9)}>9</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleOperator("*")} className="operator">
            ×
          </button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(4)}>4</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(5)}>5</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(6)}>6</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleOperator("-")} className="operator">
            −
          </button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(1)}>1</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(2)}>2</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(3)}>3</button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleOperator("+")} className="operator">
            +
          </button>
          <button onMouseDown={preventButtonFocus} onClick={() => handleNumberInput(0)} className="zero">
            0
          </button>
          <button onMouseDown={preventButtonFocus} onClick={handleDecimal}>.</button>
          <button onMouseDown={preventButtonFocus} onClick={handleEquals} className="operator">
            =
          </button>
        </div>
      </div>

      {showHistory && (
        <div className="calculator-history">
          <h4>Histórico</h4>
          <ul>
            {history.map((item, idx) => (
              <li key={idx} onClick={() => handleHistoryClick(item)}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Calculadora;

