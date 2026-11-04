import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import StartupError from './StartupError';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export default class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Umnotho render error:', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <StartupError
          title="Something went wrong"
          message="A page failed to render. The error is shown below so you can fix it instead of staring at a blank screen."
          details={[this.state.error.message]}
        />
      );
    }

    return this.props.children;
  }
}
