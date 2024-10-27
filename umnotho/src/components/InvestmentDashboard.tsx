import React, { useState } from 'react';

interface Investment {
  name: string;
  amount: number;
  returnPercentage: number;
}

const InvestmentDashboard: React.FC = () => {
  const [investments] = useState<Investment[]>([
    { name: 'Community Farm', amount: 1000, returnPercentage: 5 },
  ]);

  return (
    <div className="investment-dashboard">
      <h2>Investment Dashboard</h2>
      {investments.map((investment, index) => (
        <div key={index}>
          <h3>{investment.name}</h3>
          <p>Invested Amount: ${investment.amount}</p>
          <p>Expected Return: {investment.returnPercentage}%</p>
        </div>
      ))}
    </div>
  );
};

export default InvestmentDashboard;
