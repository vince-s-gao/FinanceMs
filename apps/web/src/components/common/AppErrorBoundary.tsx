'use client';

import React from 'react';
import { Button, Result } from 'antd';

type AppErrorBoundaryProps = {
  children: React.ReactNode;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export default class AppErrorBoundary extends React.Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Dashboard render error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6">
          <Result
            status="error"
            title="页面组件加载失败"
            subTitle="请重试，或刷新页面后继续操作。"
            extra={
              <Button type="primary" onClick={this.handleRetry}>
                重试
              </Button>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

