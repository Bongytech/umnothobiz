import React, { useState } from 'react';

interface Goal {
  title: string;
  description: string;
  amount: number;
  progress: number;
}

const CrowdfundingGoals: React.FC = () => {
  const [goals] = useState<Goal[]>([
    { title: 'Community Garden', description: 'Help us grow!', amount: 500, progress: 200 },
  ]);

  return (
    <div className="crowdfunding-goals">
      <h2>Crowdfunding Goals</h2>
      {goals.map((goal, index) => (
        <div key={index}>
          <h3>{goal.title}</h3>
          <p>{goal.description}</p>
          <p>Goal: ${goal.amount} - Raised: ${goal.progress}</p>
          <progress value={goal.progress} max={goal.amount}></progress>
        </div>
      ))}
    </div>
  );
};

export default CrowdfundingGoals;
